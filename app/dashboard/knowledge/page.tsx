// app/dashboard/knowledge/page.tsx - Knowledge base index (redirects to files)
import { redirect } from 'next/navigation';

export default function KnowledgePage() {
  redirect('/dashboard/knowledge/files');
}
