
"use client";

import type { FormEvent} from 'react';
import React, { useState, useEffect, useRef } from 'react';
import type { Template, TemplateWithoutId, AdditionalFile } from '@/types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { generateTemplateMetadata, type GenerateTemplateMetadataOutput } from '@/ai/flows/template-generation';
import { Wand2, Loader2, Save, Trash2, FileJson, ImageUp, Eye, EyeOff, Video, Sparkles, Ban, Paperclip, FileText } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import Image from 'next/image';
import DynamicLucideIcon from '@/components/DynamicLucideIcon';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

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
  keyFeatures: [],
  type: 'unknown',
  imageUrl: '',
  imageVisible: true,
  videoUrl: '',
  iconName: '',
  additionalFiles: [],
};

// Curated list of available Lucide icons for the dropdown
const availableIcons: string[] = [
  'Zap', 'Mail', 'MessageSquare', 'Users', 'Database', 'BarChart', 'LineChart', 'PieChart',
  'Settings', 'Code', 'Terminal', 'Link', 'FileText', 'Folder', 'Cloud', 'Shield',
  'KeyRound', 'Bot', 'Brain', 'Rocket', 'Lightbulb', 'ClipboardList', 'CalendarDays',
  'Clock', 'ShoppingCart', 'CreditCard', 'Gift', 'MapPin', 'Globe', 'Server',
  'Smartphone', 'Tablet', 'Laptop', 'Monitor', 'Package', 'Box', 'Archive',
  'Edit3', 'Trash2', 'PlusCircle', 'MinusCircle', 'XCircle', 'CheckCircle',
  'AlertTriangle', 'Info', 'HelpCircle', 'Award', 'Star', 'ThumbsUp', 'ThumbsDown',
  'Eye', 'EyeOff', 'Filter', 'Search', 'Share2', 'Download', 'UploadCloud',
  'Wand2', 'Sparkles', 'Files', 'Combine', 'ListChecks', 'Video', 'Image', 'Palette',
  'Layers', 'Shuffle', 'Target', 'Anchor', 'AppWindow', 'Atom', 'Bell', 'Bike',
  'BookOpen', 'Briefcase', 'Building', 'Camera', 'Car', 'ClipboardCopy', 'Cog',
  'Compass', 'Cpu', 'Disc', 'DraftingCompass', 'Droplet', 'Feather', 'Flag',
  'Flame', 'FlaskConical', 'Gamepad2', 'Gauge', 'Gem', 'GraduationCap', 'Grid',
  'HardDrive', 'Headphones', 'Heart', 'Home', 'Keyboard', 'Lamp', 'LifeBuoy',
  'Lock', 'LogIn', 'LogOut', 'Map', 'Medal', 'Megaphone', 'Menu', 'Mic', 'Mouse',
  'Navigation', 'Network', 'Paperclip', 'PenTool', 'Percent', 'Phone', 'Pin',
  'Plug', 'Printer', 'Puzzle', 'QrCode', 'Radio', 'Scaling', 'Scissors',
  'Send', 'Siren', 'Speaker', 'SquareTerminal', 'Sticker', 'Sun', 'Moon', 'Sunrise',
  'Sunset', 'SwissFranc', 'SwitchCamera', 'Tag', 'Ticket', 'ToggleLeft', 'ToggleRight',
  'Tool', 'Train', 'TrendingUp', 'TrendingDown', 'Trophy', 'Umbrella', 'Unplug',
  'Usb', 'Utensils', 'Verified', 'View', 'Wallet', 'Watch', 'Wifi', 'Wind', 'Wrench',
  'ZoomIn', 'ZoomOut'
];

const NO_ICON_VALUE = "@none"; // Special value for "No Icon" option, interpreted as empty string


const AddTemplateForm = ({ onSave, existingTemplate, onDelete }: AddTemplateFormProps) => {
  const [formData, setFormData] = useState<TemplateWithoutId & { price?: string; paymentLink?: string | null }>(
    existingTemplate ? {
      ...initialFormState,
      ...existingTemplate,
      price: existingTemplate.price || '',
      paymentLink: existingTemplate.paymentLink || '',
      imageVisible: existingTemplate.imageVisible ?? true, 
      videoUrl: existingTemplate.videoUrl || '',
      iconName: existingTemplate.iconName || '',
      additionalFiles: existingTemplate.additionalFiles || [],
    } : initialFormState
  );
const [isGenerating, setIsGenerating] = useState(false);
const [useCasesInput, setUseCasesInput] = useState(existingTemplate?.useCases?.join('\n') || '');
const [keyFeaturesInput, setKeyFeaturesInput] = useState(existingTemplate?.keyFeatures?.join('\n') || '');
const [uploadedJsonFileName, setUploadedJsonFileName] = useState<string | null>(null);
  const [uploadedImageFileName, setUploadedImageFileName] = useState<string | null>(null);
  const [additionalAiContext, setAdditionalAiContext] = useState('');
  const jsonFileInputRef = useRef<HTMLInputElement>(null);
  const imageFileInputRef = useRef<HTMLInputElement>(null);
  const additionalFilesInputRef = useRef<HTMLInputElement>(null);
  const [uploadedAdditionalFileDetails, setUploadedAdditionalFileDetails] = useState<{name: string}[]>([]);
  const { toast } = useToast();

  useEffect(() => {
    if (existingTemplate) {
      setFormData({ 
        ...initialFormState, 
        ...existingTemplate, 
        imageVisible: existingTemplate.imageVisible ?? true, 
        videoUrl: existingTemplate.videoUrl || '',
        iconName: existingTemplate.iconName || '',
        additionalFiles: existingTemplate.additionalFiles || [],
        price: existingTemplate.price || '',
        paymentLink: existingTemplate.paymentLink || '',
      });
      setUseCasesInput(existingTemplate.useCases?.join('\n') ?? '');
      setKeyFeaturesInput(existingTemplate.keyFeatures?.join('\n') ?? '');
      if (existingTemplate.templateData) {
        setUploadedJsonFileName("existing_template.json");
      } else {
        setUploadedJsonFileName(null);
      }
      if (existingTemplate.imageUrl) {
        setUploadedImageFileName("existing_image"); 
      } else {
        setUploadedImageFileName(null);
      }
      setUploadedAdditionalFileDetails((existingTemplate.additionalFiles || []).map(f => ({name: f.filename})));

    } else {
      setFormData(initialFormState);
      setUseCasesInput('');
      setKeyFeaturesInput('');
      setUploadedJsonFileName(null);
      setUploadedImageFileName(null);
      setUploadedAdditionalFileDetails([]);
    }
    setAdditionalAiContext(''); 
  }, [existingTemplate]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleTypeSelectChange = (value: string) => {
    setFormData(prev => ({ ...prev, type: value as 'n8n' | 'make.com' | 'unknown'}));
  };
  
  const handleIconSelect = (iconNameValue: string) => {
    setFormData(prev => ({ ...prev, iconName: iconNameValue === NO_ICON_VALUE ? '' : iconNameValue }));
  };
  
  const handleUseCasesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setUseCasesInput(e.target.value);
    setFormData(prev => ({ ...prev, useCases: e.target.value.split('\n').filter(uc => uc.trim() !== '') }));
  };

  const handleKeyFeaturesChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setKeyFeaturesInput(e.target.value);
    setFormData(prev => ({ ...prev, keyFeatures: e.target.value.split('\n').filter(kf => kf.trim() !== '') }));
  };

  const handleJsonFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type === 'application/json') {
        const reader = new FileReader();
        reader.onload = (e) => {
          try {
            const content = e.target?.result as string;
            JSON.parse(content); // Validate JSON
            setFormData(prev => ({ ...prev, templateData: content }));
            setUploadedJsonFileName(file.name);
            toast({ title: "JSON File Uploaded", description: `${file.name} loaded successfully.` });
          } catch (err) {
            toast({ title: "Invalid JSON", description: "The uploaded JSON file is not valid.", variant: "destructive" });
            setUploadedJsonFileName(null);
            setFormData(prev => ({ ...prev, templateData: '' }));
            if (jsonFileInputRef.current) jsonFileInputRef.current.value = ""; 
          }
        };
        reader.onerror = () => {
          toast({ title: "File Read Error", description: "Could not read the JSON file.", variant: "destructive" });
          setUploadedJsonFileName(null);
          if (jsonFileInputRef.current) jsonFileInputRef.current.value = "";
        };
        reader.readAsText(file);
      } else {
        toast({ title: "Invalid File Type", description: "Please upload a .json file for template data.", variant: "destructive" });
        setUploadedJsonFileName(null);
        if (jsonFileInputRef.current) jsonFileInputRef.current.value = "";
      }
    }
  };

  const handleImageFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const content = e.target?.result as string;
          setFormData(prev => ({ ...prev, imageUrl: content }));
          setUploadedImageFileName(file.name);
          toast({ title: "Image Uploaded", description: `${file.name} loaded successfully.` });
        };
        reader.onerror = () => {
          toast({ title: "Image Read Error", description: "Could not read the image file.", variant: "destructive" });
          setUploadedImageFileName(null);
          setFormData(prev => ({ ...prev, imageUrl: ''}));
          if (imageFileInputRef.current) imageFileInputRef.current.value = "";
        };
        reader.readAsDataURL(file); 
      } else {
        toast({ title: "Invalid File Type", description: "Please upload an image file (e.g., PNG, JPG).", variant: "destructive" });
        setUploadedImageFileName(null);
         setFormData(prev => ({ ...prev, imageUrl: ''}));
        if (imageFileInputRef.current) imageFileInputRef.current.value = "";
      }
    }
  };

  const handleAdditionalFilesChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files && files.length > 0) {
      const filePromises = Array.from(files).map(file => {
        return new Promise<AdditionalFile>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => {
            const content = e.target?.result as string;
            resolve({ filename: file.name, content });
          };
          reader.onerror = (error) => reject(error);
          // For simplicity in this prototype, reading all as text.
          // For binary files, use readAsDataURL and store as data URI.
          reader.readAsText(file); 
        });
      });

      try {
        const newFiles = await Promise.all(filePromises);
        setFormData(prev => ({ ...prev, additionalFiles: [...(prev.additionalFiles || []), ...newFiles] }));
        setUploadedAdditionalFileDetails(prev => [...prev, ...newFiles.map(f => ({ name: f.filename }))]);
        toast({ title: `${newFiles.length} Additional File(s) Processed`, description: "Ready to be saved with the template." });
      } catch (error) {
        toast({ title: "Error Reading Additional Files", description: "Some additional files could not be processed.", variant: "destructive" });
      }
      if(additionalFilesInputRef.current) additionalFilesInputRef.current.value = ""; // Reset file input
    }
  };


  const handleGenerateMetadata = async () => {
    const currentTemplateData = formData.templateData;
    if (!currentTemplateData?.trim()) {
      toast({ title: "Input Missing", description: "Please upload a template JSON file first.", variant: "destructive" });
      return;
    }
    setIsGenerating(true);
    try {
      const result: GenerateTemplateMetadataOutput = await generateTemplateMetadata({ 
        templateData: currentTemplateData,
        additionalContext: additionalAiContext || undefined,
      });
      setFormData(prev => ({
        ...prev, 
        title: result.title,
        summary: result.summary,
        setupGuide: result.setupGuide,
        useCases: result.useCases,
        keyFeatures: result.keyFeatures,
        iconName: result.iconName || prev.iconName || '', // Prioritize AI, then existing, then empty
      }));
      setUseCasesInput(result.useCases.join('\n'));
      setKeyFeaturesInput(result.keyFeatures.join('\n'));
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
    if (!existingTemplate) {
      setFormData(initialFormState);
      setUseCasesInput('');
      setKeyFeaturesInput('');
      setUploadedJsonFileName(null);
      setUploadedImageFileName(null);
      setAdditionalAiContext('');
      setUploadedAdditionalFileDetails([]);
      if (jsonFileInputRef.current) jsonFileInputRef.current.value = "";
      if (imageFileInputRef.current) imageFileInputRef.current.value = "";
      if (additionalFilesInputRef.current) additionalFilesInputRef.current.value = "";
    }
  };

  return (
    <Card className="w-full shadow-xl border-border">
      <CardHeader>
        <CardTitle className="text-2xl font-bold glow-text">
          {existingTemplate ? 'Edit Template' : 'Add New Template'}
        </CardTitle>
        <CardDescription>
          {existingTemplate ? 'Update the details of this template.' : 'Fill in the template details manually or use AI to generate them from an uploaded JSON file.'}
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
              <Select value={formData.type} onValueChange={handleTypeSelectChange}>
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
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
             <div className="space-y-2">
              <Label htmlFor="price" className="font-semibold">Price (e.g., $10, Free)</Label>
              <Input id="price" name="price" value={formData.price} onChange={handleChange} placeholder="Free" required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="paymentLink" className="font-semibold">Payment Link (Optional)</Label>
              <Input id="paymentLink" name="paymentLink" value={formData.paymentLink || ''} onChange={handleChange} placeholder="https://buy.stripe.com/..." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-2">
              <TooltipProvider>
                <Label htmlFor="iconGrid" className="font-semibold flex items-center">
                  <Sparkles className="mr-2 h-5 w-5 text-accent"/> Select Icon
                </Label>
                <div className="flex items-center gap-2 mb-2">
                  {formData.iconName ? (
                    <div className="p-1 border border-border rounded flex items-center gap-2 bg-card/50">
                      <DynamicLucideIcon name={formData.iconName} className="h-5 w-5 text-primary" />
                      <span className="text-xs">{formData.iconName}</span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">No icon selected</span>
                  )}
                  {formData.iconName && (
                    <Button variant="ghost" size="sm" className="h-7 px-2 text-xs" onClick={() => handleIconSelect(NO_ICON_VALUE)}>
                      Clear
                    </Button>
                  )}
                </div>
                
                <ScrollArea className="h-[160px] w-full rounded-md border p-2 bg-background/30">
                  <div id="iconGrid" className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className={cn(
                            "aspect-square h-9 w-9 flex items-center justify-center focus:ring-primary focus:border-primary",
                            (!formData.iconName || formData.iconName === '') && "ring-2 ring-primary border-primary bg-primary/10"
                          )}
                          onClick={() => handleIconSelect(NO_ICON_VALUE)}
                        >
                          <Ban className="h-4 w-4" />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>No Icon</TooltipContent>
                    </Tooltip>

                    {availableIcons.map(iconKey => (
                      <Tooltip key={iconKey}>
                        <TooltipTrigger asChild>
                          <Button
                            type="button"
                            variant="outline"
                            size="icon"
                            className={cn(
                              "aspect-square h-9 w-9 flex items-center justify-center focus:ring-primary focus:border-primary",
                              formData.iconName === iconKey && "ring-2 ring-primary border-primary bg-primary/10"
                            )}
                            onClick={() => handleIconSelect(iconKey)}
                          >
                            <DynamicLucideIcon name={iconKey} className="h-4 w-4" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>{iconKey}</TooltipContent>
                      </Tooltip>
                    ))}
                  </div>
                </ScrollArea>
              </TooltipProvider>
            </div>

            <div className="space-y-2">
              <Label htmlFor="templateImageFile" className="font-semibold flex items-center">
                <ImageUp className="mr-2 h-5 w-5 text-accent"/> Template Image
              </Label>
              <Input 
                id="templateImageFile" 
                name="templateImageFile" 
                type="file" 
                accept="image/*" 
                onChange={handleImageFileChange}
                ref={imageFileInputRef}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              {uploadedImageFileName && <p className="text-xs text-muted-foreground mt-1">Loaded: {uploadedImageFileName}</p>}
              {formData.imageUrl && (
                <div className="mt-2 relative w-full h-32 border border-border rounded overflow-hidden bg-muted/30">
                  <Image src={formData.imageUrl} alt="Preview" layout="fill" objectFit="contain" />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2 flex items-center">
            <Checkbox
              id="imageVisible"
              checked={formData.imageVisible}
              onCheckedChange={(checked) => setFormData(prev => ({ ...prev, imageVisible: Boolean(checked) }))}
            />
            <Label htmlFor="imageVisible" className="ml-2 font-medium flex items-center cursor-pointer">
              {formData.imageVisible ? <Eye className="mr-2 h-5 w-5 text-primary"/> : <EyeOff className="mr-2 h-5 w-5 text-muted-foreground"/>}
              Show Image on Detail Page (Image takes precedence over icon if visible and provided)
            </Label>
          </div>

          <div className="space-y-2">
            <Label htmlFor="videoUrl" className="font-semibold flex items-center">
              <Video className="mr-2 h-5 w-5 text-accent"/> Optional Video URL (e.g., YouTube)
            </Label>
            <Input id="videoUrl" name="videoUrl" value={formData.videoUrl || ''} onChange={handleChange} placeholder="https://www.youtube.com/watch?v=example" />
          </div>
          
          <div className="p-4 border border-dashed border-accent/50 rounded-lg space-y-4 bg-card/30">
            <div className="space-y-2">
              <Label htmlFor="templateJsonFile" className="font-semibold text-accent flex items-center">
                <FileJson className="mr-2 h-5 w-5"/> Upload Template JSON File (n8n or Make.com)
              </Label>
              <Input 
                id="templateJsonFile" 
                name="templateJsonFile" 
                type="file" 
                accept=".json,application/json" 
                onChange={handleJsonFileChange}
                ref={jsonFileInputRef}
                className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              />
              {uploadedJsonFileName && <p className="text-xs text-muted-foreground">Loaded: {uploadedJsonFileName}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="additionalAiContext" className="font-semibold text-accent">Optional Additional Context for AI</Label>
              <Textarea
                id="additionalAiContext"
                name="additionalAiContext"
                value={additionalAiContext}
                onChange={(e) => setAdditionalAiContext(e.target.value)}
                placeholder="e.g., Focus on simplicity for the setup guide, or highlight benefits for e-commerce users."
                rows={3}
              />
            </div>

            <Button type="button" onClick={handleGenerateMetadata} disabled={isGenerating || !formData.templateData?.trim()} variant="outline" className="w-full sm:w-auto border-accent text-accent hover:bg-accent hover:text-accent-foreground">
              {isGenerating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Wand2 className="mr-2 h-4 w-4" />}
              Generate with AI
            </Button>
             {isGenerating && <p className="text-xs text-muted-foreground flex items-center"><Loader2 className="mr-1 h-3 w-3 animate-spin"/>AI is thinking... this may take a moment.</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="additionalFiles" className="font-semibold flex items-center">
              <Paperclip className="mr-2 h-5 w-5 text-accent"/> Additional Supporting Files (Optional)
            </Label>
            <Input 
              id="additionalFiles" 
              name="additionalFiles" 
              type="file" 
              onChange={handleAdditionalFilesChange}
              ref={additionalFilesInputRef}
              className="block w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
              multiple
            />
            {uploadedAdditionalFileDetails.length > 0 && (
              <div className="mt-2 text-xs text-muted-foreground">
                <p className="font-semibold">Attached files ({uploadedAdditionalFileDetails.length}):</p>
                <ScrollArea className="h-20 border rounded-md p-2 bg-muted/10">
                  <ul className="list-disc list-inside pl-2">
                    {uploadedAdditionalFileDetails.map((file, index) => (
                      <li key={`${file.name}-${index}`} className="truncate">{file.name}</li>
                    ))}
                  </ul>
                </ScrollArea>
              </div>
            )}
          </div>


          <div className="space-y-2">
            <Label htmlFor="setupGuide" className="font-semibold">Setup Guide (Steps or Markdown)</Label>
            <Textarea id="setupGuide" name="setupGuide" value={formData.setupGuide} onChange={handleChange} placeholder="1. Connect API...\n2. Configure settings..." rows={5}/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="keyFeaturesInput" className="font-semibold">Key Features (one per line)</Label>
            <Textarea id="keyFeaturesInput" name="keyFeaturesInput" value={keyFeaturesInput} onChange={handleKeyFeaturesChange} placeholder="Feature 1\nFeature 2" rows={4}/>
          </div>

          <div className="space-y-2">
            <Label htmlFor="useCasesInput" className="font-semibold">Use Cases (one per line)</Label>
            <Textarea id="useCasesInput" name="useCasesInput" value={useCasesInput} onChange={handleUseCasesChange} placeholder="Automate customer support\nStreamline sales process" rows={4}/>
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
