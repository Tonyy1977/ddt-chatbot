import FullChat from "../src/FullChat";
import AdminDashboard from "../src/AdminDashboard";
import ChatToggle from "../src/ChatToggle";

export default function Home({ query }) {
  const mode = query.mode || "chat";

  if (mode === "admin") {
    return <AdminDashboard />;
  }
  if (mode === "toggle") {
    return <ChatToggle />;
  }
  return <FullChat />;
}

// 👇 This forces Vercel to render fresh each request
export async function getServerSideProps(context) {
  return { props: { query: context.query } };
}
