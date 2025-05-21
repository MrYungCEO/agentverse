"use client";

import type { Template } from '@/types';
import React, { useState, useMemo } from 'react';
import { useTemplates } from '@/contexts/TemplateContext';
import TemplateCard from './TemplateCard';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Frown } from 'lucide-react';

const TemplateList = () => {
  const { templates, loading, searchTemplates } = useTemplates();
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'n8n' | 'make.com'>('all');

  const filteredTemplates = useMemo(() => {
    if (loading) return [];
    return searchTemplates(searchTerm, typeFilter);
  }, [searchTerm, typeFilter, templates, loading, searchTemplates]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }
  
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row gap-4 p-4 bg-card/50 rounded-lg shadow-md border border-border">
        <Input
          type="text"
          placeholder="Search templates by name or summary..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="flex-grow futuristic-input"
        />
        <Select value={typeFilter} onValueChange={(value: 'all' | 'n8n' | 'make.com') => setTypeFilter(value)}>
          <SelectTrigger className="w-full sm:w-[180px] futuristic-select-trigger">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent className="futuristic-select-content">
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="n8n">n8n</SelectItem>
            <SelectItem value="make.com">Make.com</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredTemplates.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map((template) => (
            <TemplateCard key={template.id} template={template} />
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <Frown className="mx-auto h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold text-foreground mb-2">No Templates Found</h3>
          <p className="text-muted-foreground">
            Try adjusting your search or filter criteria, or check back later for new templates.
          </p>
        </div>
      )}
    </div>
  );
};

const CardSkeleton = () => (
  <div className="flex flex-col space-y-3 p-4 border border-border rounded-lg bg-card">
    <Skeleton className="h-[25px] w-3/4 rounded-md" />
    <Skeleton className="h-[150px] w-full rounded-md" />
    <Skeleton className="h-[60px] w-full rounded-md" />
    <Skeleton className="h-[40px] w-full rounded-md" />
  </div>
);

export default TemplateList;
