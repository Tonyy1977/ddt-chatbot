// app/api/internal-chat/route.ts - Staff-facing chat API with full Buildium access
import { NextRequest, NextResponse } from 'next/server';
import { getUser } from '@/lib/supabase/server';
import { ChatOperations, MessageOperations } from '@/db/operations';
import { INTERNAL_TOOLS } from '@/lib/buildium/tools';
import { executeInternalTool } from '@/lib/buildium/tool-executor';

const MAX_TOOL_ITERATIONS = 8;

const INTERNAL_SYSTEM_PROMPT = `You are Micah, the AI assistant for DDT Enterprise staff. You have full access to the Buildium property management system.

You can help staff with:
- Looking up tenant information, lease details, and contact info
- Checking outstanding balances and payment history for any lease
- Viewing and creating maintenance requests and work orders
- Listing properties, units, and vendors
- Creating charges (late fees, utility charges, etc.) on leases
- Getting an overview of all outstanding balances across the portfolio

Guidelines:
- Be precise and provide specific data from Buildium when available.
- Format currency as $X,XXX.XX and dates in readable format (e.g. "March 1, 2025").
- If a tool call fails, explain the error and suggest alternatives.
- You can chain multiple tool calls to answer complex questions (e.g. search tenant, then get their lease, then get balance).
- When the user asks about "who owes money" or "overdue tenants", use get_all_outstanding_balances.

### Data Presentation Rules (CRITICAL)
- NEVER use markdown tables. They do not render properly in this chat.
- NEVER list every single item. Instead, write a **brief summary** of the data.
- NEVER show internal Buildium IDs (property IDs, tenant IDs, lease IDs, request IDs).
- Format: Start with a one-line overview (e.g. "You have 50 maintenance requests: 1 in progress, 49 completed."), then highlight only the most important items (open/active/overdue) in 2-3 sentences. Offer to go deeper if they want.
- For large lists, group by status or category and give counts. Example: "26 properties across VA, LA, and RI. 15 in Virginia Beach/Norfolk area, 4 in Hampton, 2 in Newport News..." Do NOT list every single one.
- When the user asks about a specific item, give full detail in a clean bullet-point format.
- Keep every response under 150 words unless the user asks for full detail.

Today is ${new Date().toISOString().slice(0, 10)}.`;

export async function POST(request: NextRequest) {
  // Auth check - must be logged in to dashboard
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { message: string; chatId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.message || typeof body.message !== 'string') {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  try {
    // Find or create internal chat session for this staff user
    const sessionId = `internal-${user.id}`;
    const chat = body.chatId
      ? (await ChatOperations.getById(body.chatId)) || (await ChatOperations.findOrCreate(sessionId))
      : await ChatOperations.findOrCreate(sessionId);

    // Save user message
    await MessageOperations.add(chat.id, 'user', body.message);

    // Get conversation history
    const historyDocs = await MessageOperations.getByChatId(chat.id);
    const historyMessages = historyDocs.map(m => ({
      role: m.role === 'user' ? 'user' as const : 'assistant' as const,
      content: m.content,
    }));

    // Build messages for OpenAI
    let currentMessages: any[] = [
      { role: 'system', content: INTERNAL_SYSTEM_PROMPT },
      ...historyMessages,
    ];

    // Tool-calling loop
    let finalContent = '';
    let iterations = 0;

    while (iterations < MAX_TOOL_ITERATIONS) {
      iterations++;

      const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: currentMessages,
          tools: INTERNAL_TOOLS,
          tool_choice: 'auto',
        }),
      });

      if (!openaiRes.ok) {
        const errorData = await openaiRes.json();
        console.error('OpenAI error:', errorData);
        return NextResponse.json({ error: 'OpenAI request failed', details: errorData }, { status: 502 });
      }

      const data = await openaiRes.json();
      const choice = data.choices?.[0];
      if (!choice) break;

      const assistantMessage = choice.message;
      currentMessages.push(assistantMessage);

      // If no tool calls, we have the final response
      if (choice.finish_reason === 'stop' || !assistantMessage.tool_calls?.length) {
        finalContent = assistantMessage.content || '';
        break;
      }

      // Execute each tool call
      for (const toolCall of assistantMessage.tool_calls) {
        const fnName = toolCall.function.name;
        let fnArgs: Record<string, any> = {};
        try { fnArgs = JSON.parse(toolCall.function.arguments); } catch {}

        const result = await executeInternalTool(fnName, fnArgs);
        console.log(`[Internal] Tool: ${fnName} → success=${result.success}`);

        currentMessages.push({
          role: 'tool',
          tool_call_id: toolCall.id,
          content: JSON.stringify(result),
        });
      }
    }

    // Save bot response
    if (finalContent) {
      await MessageOperations.add(chat.id, 'assistant', finalContent);
    }

    return NextResponse.json({
      chatId: chat.id,
      message: finalContent,
    });
  } catch (err: any) {
    console.error('Internal chat error:', err);
    return NextResponse.json(
      { error: 'Chat failed', details: err.message },
      { status: 500 },
    );
  }
}
