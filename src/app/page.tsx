
import TemplateList from '@/components/templates/TemplateList';
import ChatWidget from '@/components/chat/ChatWidget';
import KinglyAgentIcon from '@/components/KinglyAgentIcon'; // Import the icon

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="text-center py-8 md:py-12">
        <KinglyAgentIcon className="mx-auto h-20 w-20 text-primary mb-6 animate-fade-in-up" /> {/* Icon remains */}
        {/* Removed h1 and p elements */}
      </section>
      
      <section>
        <h2 className="text-3xl font-semibold mb-8 text-center glow-text">Template Library</h2>
        <TemplateList />
      </section>
      <ChatWidget />
    </div>
  );
}
