import nodemailer from "nodemailer";

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { name, email, message, captchaToken, locale } = req.body;
  const language = (locale || "en").toLowerCase().split("-")[0];
  const i18n =
    language === "fr"
      ? {
          subject: (sender) => `Nouveau message de ${sender}`,
          labelName: "Nom",
          labelEmail: "Email",
          labelMessage: "Message",
          captchaError: "Échec de la vérification reCAPTCHA.",
          sendSuccess: "Message envoyé avec succès !",
          sendError: "Erreur lors de l'envoi de l'e-mail."
        }
      : {
          subject: (sender) => `New message from ${sender}`,
          labelName: "Name",
          labelEmail: "Email",
          labelMessage: "Message",
          captchaError: "reCAPTCHA verification failed.",
          sendSuccess: "Message sent successfully!",
          sendError: "Error sending the email."
        };


  // Vérifier le token reCAPTCHA
  const verifyUrl = `https://www.google.com/recaptcha/api/siteverify?secret=${process.env.RECAPTCHA_SECRET}&response=${captchaToken}`;
 const captchaRes = await fetch(verifyUrl, { method: "POST" });
  const captchaData = await captchaRes.json();

  if (!captchaData.success) {
    return res.status(400).json({ message: i18n.captchaError });
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
      subject: i18n.subject(name),
      text: `
${i18n.labelName} : ${name}
${i18n.labelEmail} : ${email}

${i18n.labelMessage} :
${message}
      `,
    });

    return res.status(200).json({ message: i18n.sendSuccess });
  } catch (err) {
    console.error("Erreur d'envoi :", err);
    return res.status(500).json({ message: i18n.sendError });
  }
}
