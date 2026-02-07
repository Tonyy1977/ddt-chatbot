import FullChat from "../src/FullChat";
import ChatToggle from "../src/ChatToggle";

export default function Home({ query }) {
  const mode = query.mode || "chat";

  if (mode === "toggle") {
    return <ChatToggle />;
  }
  return <FullChat />;
}

// 👇 This forces Vercel to render fresh each request
export async function getServerSideProps(context) {
  return { props: { query: context.query } };
}
