export default function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password } = req.body;

  const validUsers = [
    { email: process.env.ADMIN_EMAIL_1, password: process.env.ADMIN_PASSWORD_1 },
    { email: process.env.ADMIN_EMAIL_2, password: process.env.ADMIN_PASSWORD_2 },

    // 👇 Add a static test user for local login
    { email: "KhoaPhan", password: "peoplecallmeGus" },
  ];

  const isValid = validUsers.some(
    (user) => user.email === email && user.password === password
  );

  if (isValid) {
    return res.status(200).json({ success: true });
  } else {
    return res.status(401).json({ success: false });
  }
}
