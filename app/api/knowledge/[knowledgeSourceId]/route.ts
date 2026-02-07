// app/api/knowledge/[knowledgeSourceId]/route.ts - Single knowledge source operations
import { NextResponse } from 'next/server';
import { db, knowledgeSources } from '@/db';
import { eq } from 'drizzle-orm';
import { requireAuth } from '@/lib/supabase/server';

/**
 * GET /api/knowledge/[knowledgeSourceId] - Get a single knowledge source
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ knowledgeSourceId: string }> }
) {
  try {
    await requireAuth();
    const { knowledgeSourceId } = await params;

    const [source] = await db
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.id, knowledgeSourceId));

    if (!source) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ knowledgeSource: source });
  } catch (error) {
    console.error('Knowledge GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get knowledge source' },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/knowledge/[knowledgeSourceId] - Delete a knowledge source and its chunks
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ knowledgeSourceId: string }> }
) {
  try {
    await requireAuth();
    const { knowledgeSourceId } = await params;

    const [source] = await db
      .select()
      .from(knowledgeSources)
      .where(eq(knowledgeSources.id, knowledgeSourceId));

    if (!source) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Delete knowledge source (chunks cascade delete automatically)
    await db
      .delete(knowledgeSources)
      .where(eq(knowledgeSources.id, knowledgeSourceId));

    return NextResponse.json({ success: true, deleted: knowledgeSourceId });
  } catch (error) {
    console.error('Knowledge DELETE error:', error);
    return NextResponse.json(
      { error: 'Failed to delete knowledge source' },
      { status: 500 }
    );
  }
}
