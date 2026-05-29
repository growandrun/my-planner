const BOT = () => process.env.TELEGRAM_BOT_TOKEN!;

export async function tg(method: string, body: any) {
  const r = await fetch(`https://api.telegram.org/bot${BOT()}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

export const sendMessage = (chat_id: number, text: string, reply_markup?: any) =>
  tg("sendMessage", { chat_id, text, parse_mode: "HTML", reply_markup });

export const editMessage = (chat_id: number, message_id: number, text: string, reply_markup?: any) =>
  tg("editMessageText", { chat_id, message_id, text, parse_mode: "HTML", reply_markup });

export const answerCallback = (callback_query_id: string, text?: string) =>
  tg("answerCallbackQuery", { callback_query_id, text });
