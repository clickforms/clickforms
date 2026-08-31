import { ChatBubbleIcon } from '@/components/landing/landing-icons';

export function LandingChatBubble() {
  return (
    <div className="landing-chat">
      <div className="landing-chat-bubble">Hi. Need any help?</div>
      <button type="button" className="landing-chat-button" aria-label="Open chat">
        <ChatBubbleIcon />
      </button>
    </div>
  );
}
