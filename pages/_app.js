/* eslint-disable no-unused-vars */
import "../src/App.css";  // ✅ load global CSS

export default function MyApp({ Component, pageProps }) {
  return <Component {...pageProps} />;
}
