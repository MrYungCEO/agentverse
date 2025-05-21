
import TemplateList from '@/components/templates/TemplateList';
import ChatWidget from '@/components/chat/ChatWidget';
import KinglyAgentIcon from '@/components/KinglyAgentIcon'; // Import the icon

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="text-center py-8 md:py-12">
        <KinglyAgentIcon className="mx-auto h-40 w-40 text-primary animate-fade-in-up animate-pulse-glow" /> {/* Removed mb-6 */}
        <h2 className="text-3xl font-semibold mt-2 mb-8 text-center glow-text"> {/* Added mt-2 for small gap, mb-8 for space before list */}
          Template Library
        </h2>
        <TemplateList />
      </section>
      <ChatWidget />
    </div>
  );
}
