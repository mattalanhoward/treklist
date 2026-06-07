function buildNotificationEmail({ recipientTrailname, senderTrailname, type, replyBody, postTitle, postUrl, unsubscribeUrl }) {
  const recipient = recipientTrailname || "there";
  const sender = senderTrailname || "Someone";

  const isReplyToPost = type === "reply_post";
  const contextLabel = isReplyToPost ? "your post" : "your comment";
  const subject = `${sender} replied to ${contextLabel}`;

  const truncatedBody = replyBody && replyBody.length > 400
    ? replyBody.slice(0, 400).trimEnd() + "…"
    : (replyBody || "");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>${subject}</title>
  <style>
    :root { color-scheme: light; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background-color: #e8edf2;
      font-family: Arial, Helvetica, sans-serif;
      color: #1e293b;
      -webkit-text-size-adjust: 100%;
      text-size-adjust: 100%;
    }
    .email-wrapper { max-width: 620px; margin: 0 auto; background-color: #ffffff; }
    .header {
      background-color: #0B1220;
      padding: 22px 40px;
      text-align: center;
      border-bottom: 3px solid #1d4ed8;
    }
    .header-logo {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 22px;
      font-weight: 700;
      color: #ffffff;
      text-decoration: none;
      letter-spacing: -0.01em;
      display: block;
    }
    .header-tagline {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 10px;
      font-weight: 400;
      color: #60a5fa;
      letter-spacing: 2px;
      text-transform: uppercase;
      margin-top: 5px;
    }
    .content-area {
      padding: 40px 44px;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
      line-height: 1.7;
      color: #1e293b;
    }
    .content-area p { margin-bottom: 18px; }
    .content-area a { color: #1d4ed8; text-decoration: underline; }
    .reply-box {
      background-color: #f1f5f9;
      border-left: 4px solid #1d4ed8;
      border-radius: 4px;
      padding: 16px 20px;
      margin: 24px 0;
      font-size: 15px;
      line-height: 1.6;
      color: #1e293b;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .post-context {
      font-size: 13px;
      color: #64748b;
      margin-bottom: 24px;
    }
    .cta-wrap { text-align: center; margin: 32px 0; }
    .cta-button {
      display: inline-block;
      background-color: #1d4ed8;
      color: #ffffff !important;
      text-decoration: none !important;
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 700;
      padding: 14px 32px;
      border-radius: 6px;
      letter-spacing: 0.01em;
    }
    .footer {
      background-color: #0B1220;
      padding: 28px 40px;
      text-align: center;
      border-top: 3px solid #1d4ed8;
    }
    .footer-logo {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 15px;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 12px;
    }
    .footer-links { margin-bottom: 16px; }
    .footer-links a {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1.5px;
      text-transform: uppercase;
      color: #60a5fa !important;
      text-decoration: none;
      margin: 0 10px;
    }
    .footer-text {
      font-family: Arial, Helvetica, sans-serif;
      font-size: 11px;
      line-height: 1.8;
      color: #64748b;
    }
    .footer-text a { color: #60a5fa !important; text-decoration: none; }
    @media (max-width: 640px) {
      .content-area { padding: 28px 24px; }
      .header { padding: 20px 24px; }
      .footer { padding: 24px 24px; }
    }
  </style>
</head>
<body>
<div class="email-wrapper">

  <div class="header">
    <a href="https://treklist.co" class="header-logo">TrekList</a>
    <div class="header-tagline">Free gear list planner for hikers</div>
  </div>

  <div class="content-area">
    <p>Hey ${recipient},</p>
    <p><strong>${sender}</strong> replied to ${contextLabel}${postTitle ? ` "<em>${postTitle}</em>"` : ""}:</p>
    <div class="reply-box">${truncatedBody}</div>
    <div class="cta-wrap">
      <a href="${postUrl}" class="cta-button">View reply</a>
    </div>
    <p>Happy trails,<br>The TrekList Team</p>
  </div>

  <div class="footer">
    <div class="footer-logo">TrekList</div>
    <p class="footer-text">TrekList is made by Tall Joe Hikes</p>
    <div class="footer-links">
      <a href="https://treklist.co">Build a list</a>
      <a href="https://talljoehikes.com/gear/">Gear reviews</a>
      <a href="https://talljoehikes.com/hikes/">Hike guides</a>
    </div>
    <p class="footer-text">
      You're getting this because someone replied to your post or comment on treklist.co<br>
      <a href="${unsubscribeUrl}">Unsubscribe from reply notifications</a><br><br>
      © 2026 TrekList · Tall Joe Hikes · Netherlands
    </p>
  </div>

</div>
</body>
</html>`;

  const text = `Hey ${recipient},

${sender} replied to ${contextLabel}${postTitle ? ` "${postTitle}"` : ""}:

${truncatedBody}

View the reply: ${postUrl}

Happy trails,
The TrekList Team

---
You're getting this because someone replied to your post or comment on treklist.co
Unsubscribe: ${unsubscribeUrl}`;

  return { html, text, subject };
}

module.exports = { buildNotificationEmail };
