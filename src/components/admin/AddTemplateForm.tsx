"use client";

import type { FormEvent} from 'react';
import React, { useState, useEffect } from 'react';
import type { Template, TemplateWithoutId } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { generateTemplateMetadata, type GenerateTemplateMetadataOutput } from '@/ai/flows/template-generation';
import { Wand2, Loader2, Save, Trash2, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface AddTemplateFormProps {
  onSave: (template: TemplateWithoutId | Template) => void;
  existingTemplate?: Template | null;
  onDelete?: (templateId: string) => void;
}

const initialFormState: TemplateWithoutId = {
  title: '',
  summary: '',
  templateData: '',
  setupGuide: '',
  useCases: [],
  downloadLink: '',
  type: 'unknown',
};

const AddTemplateForm = ({ onSave, existingTemplate, onDelete }: AddTemplateFormProps) => {
  const [formData, setFormData] = useState<TemplateWithoutId | Template>(
    existingTemplate || initialFormState
  );
  const [templateJson, setTemplateJson] = useState(existingTemplate?.templateData || '');
  const [isGenerating, setIsGenerating] = useState(false);
  const [useCasesInput, setUseCasesInput] = useState(existingTemplate?.useCases.join('\n') || '');
  const { toast } = useToast();

  useEffect(() => {
    if (existingTemplate) {
      setFormData(existingTemplate);
      setTemplateJson(existingTemplate.templateData || '');
      setUseCasesInput(existingTemplate.useCases.join('\n'));
    } else {
      setFormData(initialFormState);
      setTemplateJson('');
      setUseCasesInput('');
    }
  }, [existingTemplate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (value: 'n8n' | 'make.com' | 'unknown') => {
    setFormData(prev => ({ ...prev, type: value }));
  };
  
  const handleUseCasesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUseCasesInput(e.target.value);
    setFormData(prev => ({ ...prev, useCases: e.target.value.split('\n').filter(uc => uc.trim() !== '') }));
  };

  const handleGenerateMetadata = async () => {
    if (!templateJson.trim()) {
      toast({ title: "Input Missing", description: "Please paste template JSON data first.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const result: GenerateTemplateMetadataOutput = await generateTemplateMetadata({ templateData: templateJson });
      setFormData(prev => ({
        ...prev,
        title: result.title,
        summary: result.summary,
        setupGuide: result.setupGuide,
        useCases: result.useCases,
        templateData: templateJson, // Keep the original JSON
      }));
      setUseCasesInput(result.useCases.join('\n'));
      toast({ title: "AI Generation Successful", description: "Template metadata populated." });
    } catch (error) {
      console.error("AI generation failed:", error);
      toast({ title: "AI Generation Failed", description: (error as Error).message || "Could not generate metadata.", variant: "destructive" });
    }
    setIsGenerating(false);
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!formData.title || !formData.summary || formData.type === 'unknown') {
      toast({ title: "Missing Fields", description: "Please fill in title, summary, and select a type.", variant: "destructive"});
      return;
    }
    onSave(formData);
    if (!existingTemplate) { // Reset form only if it's a new template
      setFormData(initialFormState);
      setTemplateJson('');
      setUseCasesInput('');
    }
  };

  return (
    <Card className="w-full shadow-xl border-border">
      <CardHeader>
        <CardTitle className="text-2xl font-bold glow-text">
          {existingTemplate ? 'Edit Template' : 'Add New Template'}
        </CardTitle>
        <CardDescription>
          {existingTemplate ? 'Update the details of this template.' : 'Fill in the template details manually or use AI to generate them from JSON.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="title" className="font-semibold">Title</Label>
              <Input id="title" name="title" value={formData.title} onChange={handleChange} placeholder="AI Email Responder" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type" className="font-semibold">Type</Label>
              <Select value={formData.type} onValueChange={handleSelectChange}>
                <SelectTrigger id="type">
                  <SelectValue placeholder="Select template type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="n8n">n8n</SelectItem>
                  <SelectItem value="make.com">Make.com</SelectItem>
                  <SelectItem value="unknown">Unknown</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="summary" className="font-semibold">Summary</Label>
            <Textarea id="summary" name="summary" value={formData.summary} onChange={handleChange} placeholder="A brief description of what the template does." required rows={3}/>
          </div>
          
          <div className="p-4 border border-dashed border-accent/50 rounded-lg space-y-4 bg-card/30">
            <Label htmlFor="templateJson" className="font-semibold text-accent">Template JSON (n8n or Make.com)</Label>
            <Textarea
              id="templateJson"
              name="templateJson"
              value={templateJson}
              onChange={(e) => setTemplateJson(e.target.value)}
              placeholder="Paste your n8n or Make.com template JSON here..."
              rows={6}
              className="font-mono text-sm"
            />
            <Button type="button" onClick={handleGenerateMetadata} disabled={isGenerating || !templateJson.trim()} variant="outline" className="w-full sm:w-auto border-accent text-accent hover:bg-accent hover:text-accent-foreground">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Generate with AI
            </Button>
             {isGenerating && <p className="text-xs text-muted-foreground flex items-center"><Loader2 className="mr-1 h-3 w-3 animate-spin"/>AI is thinking... this may take a moment.</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="setupGuide" className="font-semibold">Setup Guide (Steps or Markdown)</Label>
            <Textarea id="setupGuide" name="setupGuide" value={formData.setupGuide} onChange={handleChange} placeholder="1. Connect API...\n2. Configure settings..." rows={5}/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="useCasesInput" className="font-semibold">Use Cases (one per line)</Label>
            <Textarea id="useCasesInput" name="useCasesInput" value={useCasesInput} onChange={handleUseCasesChange} placeholder="Automate customer support\nStreamline sales process" rows={4}/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="downloadLink" className="font-semibold">Download Link</Label>
            <Input id="downloadLink" name="downloadLink" type="url" value={formData.downloadLink} onChange={handleChange} placeholder="https://example.com/template.json" />
          </div>
          
          <div className="flex flex-col sm:flex-row justify-end gap-3 pt-4">
            {existingTemplate && onDelete && (
              <Button type="button" variant="destructive" onClick={() => onDelete(existingTemplate.id)} className="w-full sm:w-auto">
                <Trash2 className="mr-2 h-4 w-4" /> Delete
              </Button>
            )}
            <Button type="submit" className="w-full sm:w-auto glow-button">
              <Save className="mr-2 h-4 w-4" /> {existingTemplate ? 'Save Changes' : 'Add Template'}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};

export default AddTemplateForm;
