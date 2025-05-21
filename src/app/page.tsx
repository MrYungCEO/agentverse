import TemplateList from '@/components/templates/TemplateList';
import ChatWidget from '@/components/chat/ChatWidget';

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="text-center py-8 md:py-12">
        <h1 className="mb-4 text-5xl md:text-6xl font-extrabold tracking-tighter animated-gradient-text bg-clip-text text-transparent bg-gradient-to-r from-primary via-accent to-secondary">
          Welcome to AgentVerse
        </h1>
        <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto">
          Discover, explore, and download powerful n8n & Make.com automation templates. 
          Unleash the potential of AI agents for your workflows.
        </p>
      </section>
      
      <section>
        <h2 className="text-3xl font-semibold mb-8 text-center glow-text">Template Library</h2>
        <TemplateList />
      </section>
      <ChatWidget />
    </div>
  );
}
