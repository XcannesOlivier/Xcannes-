import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, email, message, captchaToken } = req.body;


  // Vérifier le token reCAPTCHA
  const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${captchaToken}`;
 const captchaRes = await fetch(verifyUrl, { method: "POST" });
  const captchaData = await captchaRes.json();

  if (!captchaData.success) {
    return res.status(400).json({ message: "Échec de la vérification reCAPTCHA." });
  }

  // Configurer Nodemailer (OVH)
  const transporter = nodemailer.createTransport({
    host: "ssl0.ovh.net",
    port: 587,
    secure: false,
    auth: {
      user: "contact@xcannes.com",
      pass: process.env.OVH_EMAIL_PASSWORD,
    },
  });

  try {
    await transporter.sendMail({
      from: `"XCannes Contact" <contact@xcannes.com>`,
      to: "contact@xcannes.com", // ou autre destinataire
      subject: `Nouveau message de ${name}`,
      text: `
Nom : ${name}
Email : ${email}

Message :
${message}
      `,
    });

    return res.status(200).json({ message: "Message envoyé avec succès !" });
  } catch (err) {
    console.error("Erreur d'envoi :", err);
    return res.status(500).json({ message: "Erreur lors de l'envoi de l'e-mail." });
  }
}
