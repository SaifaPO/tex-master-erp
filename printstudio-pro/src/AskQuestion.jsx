import { useEffect } from 'react';

// Okno "Opýtať sa" je jedno spoločné (ChatWidget, pripojené v main.jsx) — táto komponenta ho len nastaví pre konkrétnu appku:
// zdroj = názov appky v správe pre ERP, nadListou = zdvihnúť tlačidlo nad spodnú lištu appky.
export default function AskQuestion({ zdroj, nadListou = false }) {
  useEffect(() => {
    window.__pbtChatCfg = { zdroj, nadListou };
    window.dispatchEvent(new Event('pbt-chat-cfg'));
    return () => { window.__pbtChatCfg = {}; window.dispatchEvent(new Event('pbt-chat-cfg')); };
  }, [zdroj, nadListou]);
  return null;
}
