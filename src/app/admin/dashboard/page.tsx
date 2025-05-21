"use client";

import React, { useState } from 'react';
import AdminAuthGuard from '@/components/admin/AdminAuthGuard';
import AddTemplateForm from '@/components/admin/AddTemplateForm';
import { useTemplates } from '@/contexts/TemplateContext';
import type { Template, TemplateWithoutId } from '@/types';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { List, Edit3, PlusCircle, ExternalLink, Trash2, Search } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import Link from 'next/link';
import { Input } from '@/components/ui/input';

export default function AdminDashboardPage() {
  const { templates, addTemplate, updateTemplate, deleteTemplate, loading } = useTemplates();
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  const handleSaveTemplate = (templateData: TemplateWithoutId | Template) => {
    if ('id' in templateData) { // Existing template
      updateTemplate(templateData as Template);
      toast({ title: "Template Updated", description: `"${templateData.title}" has been updated.` });
    } else { // New template
      const newTemplate = addTemplate(templateData as TemplateWithoutId);
      toast({ title: "Template Added", description: `"${newTemplate.title}" has been added to the library.` });
    }
    setEditingTemplate(null);
    setShowAddForm(false);
  };

  const handleDeleteTemplate = (templateId: string) => {
    if (window.confirm("Are you sure you want to delete this template? This action cannot be undone.")) {
      const templateToDelete = templates.find(t => t.id === templateId);
      deleteTemplate(templateId);
      toast({ title: "Template Deleted", description: `"${templateToDelete?.title}" has been deleted.`, variant: "destructive" });
      if (editingTemplate?.id === templateId) {
        setEditingTemplate(null);
        setShowAddForm(false);
      }
    }
  };

  const handleEdit = (template: Template) => {
    setEditingTemplate(template);
    setShowAddForm(true);
  };

  const handleAddNew = () => {
    setEditingTemplate(null);
    setShowAddForm(true);
  };
  
  const filteredTemplates = templates.filter(template => 
    template.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    template.summary.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AdminAuthGuard>
      <div className="space-y-8 py-8">
        <header className="flex flex-col sm:flex-row justify-between items-center gap-4">
          <h1 className="text-4xl font-bold glow-text">Admin Dashboard</h1>
          <Button onClick={handleAddNew} size="lg" className="glow-button">
            <PlusCircle className="mr-2 h-5 w-5" /> Add New Template
          </Button>
        </header>

        {showAddForm || editingTemplate ? (
          <AddTemplateForm
            key={editingTemplate ? editingTemplate.id : 'new'} // Force re-render on new/edit
            onSave={handleSaveTemplate}
            existingTemplate={editingTemplate}
            onDelete={handleDeleteTemplate}
          />
        ) : null}

        <Card className="shadow-lg border-border">
          <CardHeader>
            <CardTitle className="text-2xl flex items-center"><List className="mr-3 h-6 w-6 text-primary"/>Template Library Management</CardTitle>
            <CardDescription>View, edit, or delete existing templates.</CardDescription>
            <div className="mt-4 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
              <Input 
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-muted-foreground">Loading templates...</p>
            ) : filteredTemplates.length > 0 ? (
              <ul className="space-y-4">
                {filteredTemplates.map(template => (
                  <li key={template.id} className="p-4 bg-card/50 border border-border rounded-lg flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 hover:border-primary/50 transition-colors">
                    <div>
                      <h3 className="font-semibold text-lg text-foreground">{template.title}</h3>
                      <p className="text-sm text-muted-foreground">{template.type.toUpperCase()} - Updated: {new Date(template.updatedAt).toLocaleDateString()}</p>
                    </div>
                    <div className="flex gap-2 flex-shrink-0 mt-2 sm:mt-0">
                      <Button variant="outline" size="sm" asChild>
                        <Link href={`/templates/${template.slug}`} target="_blank">
                          <ExternalLink className="mr-1 h-4 w-4" /> View
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEdit(template)}>
                        <Edit3 className="mr-1 h-4 w-4" /> Edit
                      </Button>
                      <Button variant="destructive" size="sm" onClick={() => handleDeleteTemplate(template.id)}>
                        <Trash2 className="mr-1 h-4 w-4" /> Delete
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-muted-foreground text-center py-4">No templates found matching your search, or the library is empty.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AdminAuthGuard>
  );
}
