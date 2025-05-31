const Footer = () => {
  return (
    <footer className="bg-background border-t border-border py-8 text-center text-muted-foreground">
      <div className="container mx-auto px-4">
        <p className="text-sm">
          &copy; {new Date().getFullYear()} AgentVerse. Powered by{' '}
          <a
            href="#" // Replace with actual link if available
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-primary hover:text-accent transition-colors"
          >
            Kingly Kreationz
          </a>
          .
        </p>
      </div>
    </footer>
  );
};

export default Footer;
