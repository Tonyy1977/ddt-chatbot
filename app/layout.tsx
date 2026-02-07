import './globals.css';

export const metadata = {
  title: 'DDT Enterprise - Mission Control',
  description: 'DDT Enterprise property management chatbot admin dashboard',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
