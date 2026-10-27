import { textLinks } from '@/lib/team-communication';
export function SafeChatText({ body }: { body: string }) {
  return <>{textLinks(body).map((part, index) => part.href
    ? <a key={index} href={part.href} target="_blank" rel="noopener noreferrer" className="auth-link">{part.text}</a>
    : <span key={index}>{part.text}</span>)}</>;
}