'use client';

import React, { useState, useEffect } from 'react';
import {
  HelpCircle,
  Search,
  Plus,
  Mic,
  Tag,
  MessageSquare,
  Sparkles,
  ShieldCheck,
  FolderPlus,
  Loader2,
} from 'lucide-react';
import type { D1Question, D1Category } from '@/lib/d1-database';
import { useAuth } from '@/lib/auth-context';

interface QuestionsSheetProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectQuestionToAnswer: (question: D1Question) => void;
}

export function QuestionsSheet({ isOpen, onClose, onSelectQuestionToAnswer }: QuestionsSheetProps) {
  const { user, token } = useAuth();
  const [questions, setQuestions] = useState<D1Question[]>([]);
  const [categories, setCategories] = useState<D1Category[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(true);

  // Ask Question Form State
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [newQuestionTitle, setNewQuestionTitle] = useState<string>('');
  const [newQuestionCategory, setNewQuestionCategory] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Admin Category Creation State
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);
  const [newCategoryName, setNewCategoryName] = useState<string>('');
  const [newCategoryDesc, setNewCategoryDesc] = useState<string>('');
  const [isAddingCat, setIsAddingCat] = useState<boolean>(false);

  const loadData = React.useCallback(async () => {
    setLoading(true);
    try {
      const [catRes, qRes] = await Promise.all([
        fetch('/api/categories'),
        fetch(`/api/questions?category=${selectedCategory}&search=${encodeURIComponent(searchQuery)}`),
      ]);
      const catData = await catRes.json();
      const qData = await qRes.json();
      setCategories(catData.categories || []);
      setQuestions(qData.questions || []);

      if (catData.categories && catData.categories.length > 0 && !newQuestionCategory) {
        setNewQuestionCategory(catData.categories[0].id);
      }
    } catch (e) {
      console.error('Failed to load questions', e);
    } finally {
      setLoading(false);
    }
  }, [selectedCategory, searchQuery, newQuestionCategory]);

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, loadData]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handlePostQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newQuestionTitle.trim() || newQuestionTitle.length < 5) {
      setFormError('Please enter a thought-provoking question of at least 5 characters.');
      return;
    }
    if (!newQuestionCategory) {
      setFormError('Please select a category for this question.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          title: newQuestionTitle,
          category_id: newQuestionCategory,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to post question');
      }

      // Add to list and close form
      setQuestions((prev) => [data.question, ...prev]);
      setNewQuestionTitle('');
      setIsAsking(false);
    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;

    setIsAddingCat(true);
    try {
      const res = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          description: newCategoryDesc.trim(),
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setCategories((prev) => [...prev, data.category]);
        setNewCategoryName('');
        setNewCategoryDesc('');
        setIsAdminMode(false);
      }
    } catch (e) {
      console.error('Failed to add category', e);
    } finally {
      setIsAddingCat(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      id="questions-sheet-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-end bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="questions-sheet-drawer"
        className="w-full max-w-xl h-full bg-zinc-900 border-l border-zinc-800 text-zinc-100 flex flex-col shadow-2xl animate-in slide-in-from-right duration-300"
      >
        {/* Header */}
        <div className="p-5 border-b border-zinc-800/80 flex items-center justify-between bg-zinc-900/90 backdrop-blur-md">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
              <HelpCircle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-zinc-100">Street Prompts & Questions</h2>
              <p className="text-xs text-zinc-400">Questions are text • Answers are Voice Ruts</p>
            </div>
          </div>
          <button
            id="close-questions-sheet-btn"
            onClick={onClose}
            className="w-8 h-8 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 flex items-center justify-center text-sm transition-colors"
          >
            ✕
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="p-4 border-b border-zinc-800 bg-zinc-950/40 flex items-center justify-between gap-3">
          <form onSubmit={handleSearch} className="relative flex-1">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              id="search-questions-input"
              type="text"
              placeholder="Search street questions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-zinc-850 border border-zinc-750 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-500"
            />
          </form>

          <button
            id="ask-new-question-btn"
            onClick={() => setIsAsking(!isAsking)}
            className="px-3.5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5" />
            Ask Question
          </button>
        </div>

        {/* Category Pills */}
        <div className="px-4 py-2.5 border-b border-zinc-800/80 bg-zinc-900/60 overflow-x-auto flex items-center gap-2 scrollbar-none">
          <button
            id="category-pill-all"
            onClick={() => setSelectedCategory('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors ${
              selectedCategory === 'all'
                ? 'bg-amber-500 text-zinc-950'
                : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
            }`}
          >
            All Prompts
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              id={`category-pill-${c.id}`}
              onClick={() => setSelectedCategory(c.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-colors flex items-center gap-1.5 ${
                selectedCategory === c.id
                  ? 'bg-amber-500 text-zinc-950 font-semibold'
                  : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: c.color || '#f59e0b' }} />
              {c.name}
            </button>
          ))}
          <button
            id="admin-category-toggle-btn"
            onClick={() => setIsAdminMode(!isAdminMode)}
            className="px-2.5 py-1.5 rounded-full text-[11px] font-mono text-zinc-400 hover:text-amber-300 bg-zinc-850 hover:bg-zinc-800 flex items-center gap-1 ml-auto whitespace-nowrap"
            title="Admin Category Manager"
          >
            <FolderPlus className="w-3 h-3" />
            + Category (Admin)
          </button>
        </div>

        {/* Admin Category Creator Drawer */}
        {isAdminMode && (
          <div className="p-4 bg-amber-500/10 border-b border-amber-500/30 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 mb-2 text-xs font-semibold text-amber-300">
              <ShieldCheck className="w-4 h-4" />
              Admin Category Configuration
            </div>
            <form onSubmit={handleAddCategory} className="space-y-2">
              <input
                type="text"
                placeholder="Category Name (e.g. Midnight Confessions)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
              />
              <input
                type="text"
                placeholder="Category Description"
                value={newCategoryDesc}
                onChange={(e) => setNewCategoryDesc(e.target.value)}
                className="w-full px-3 py-1.5 bg-zinc-900 border border-zinc-700 rounded-lg text-xs text-zinc-100 focus:outline-none focus:border-amber-400"
              />
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAdminMode(false)}
                  className="px-3 py-1 rounded-lg bg-zinc-800 text-xs text-zinc-400 hover:text-zinc-200"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isAddingCat || !newCategoryName.trim()}
                  className="px-3 py-1 rounded-lg bg-amber-500 text-zinc-950 font-medium text-xs hover:bg-amber-400 disabled:opacity-50"
                >
                  {isAddingCat ? 'Saving...' : 'Add Category'}
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Post New Question Collapsible Box */}
        {isAsking && (
          <div className="p-4 bg-zinc-850 border-b border-zinc-750 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-zinc-300 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                Post a Street Question for Strangers
              </span>
              <button
                onClick={() => setIsAsking(false)}
                className="text-xs text-zinc-500 hover:text-zinc-300"
              >
                ✕ Cancel
              </button>
            </div>

            <form onSubmit={handlePostQuestion} className="space-y-3">
              <textarea
                id="new-question-textarea"
                rows={3}
                placeholder="Ask a question you would ask a total stranger at 2 AM..."
                value={newQuestionTitle}
                onChange={(e) => setNewQuestionTitle(e.target.value)}
                className="w-full p-3 bg-zinc-900 border border-zinc-700 rounded-xl text-xs text-zinc-100 placeholder:text-zinc-500 focus:outline-none focus:border-amber-400 resize-none"
              />

              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Tag className="w-3.5 h-3.5 text-zinc-400" />
                  <select
                    id="new-question-category-select"
                    value={newQuestionCategory}
                    onChange={(e) => setNewQuestionCategory(e.target.value)}
                    className="bg-zinc-900 border border-zinc-700 rounded-lg px-2.5 py-1.5 text-xs text-zinc-200 focus:outline-none focus:border-amber-400"
                  >
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  id="submit-question-btn"
                  type="submit"
                  disabled={isSubmitting || !newQuestionTitle.trim()}
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-semibold text-xs flex items-center gap-1.5 disabled:opacity-50 transition-colors"
                >
                  {isSubmitting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  Post Question
                </button>
              </div>

              {formError && <p className="text-xs text-rose-400">{formError}</p>}
            </form>
          </div>
        )}

        {/* Questions List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-48 text-zinc-400 gap-2">
              <Loader2 className="w-6 h-6 animate-spin text-amber-500" />
              <span className="text-xs">Gathering street prompts...</span>
            </div>
          ) : questions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-56 text-center text-zinc-400 gap-2">
              <HelpCircle className="w-8 h-8 text-zinc-600" />
              <p className="text-sm font-medium text-zinc-300">No questions found</p>
              <p className="text-xs text-zinc-500 max-w-xs">
                Be the first to post a text inquiry on this corner and let strangers answer with their voice!
              </p>
              <button
                onClick={() => setIsAsking(true)}
                className="mt-2 px-3.5 py-1.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-xs text-amber-300 font-medium"
              >
                + Post Question
              </button>
            </div>
          ) : (
            questions.map((q) => (
              <div
                key={q.id}
                id={`question-card-${q.id}`}
                className="p-4 rounded-xl bg-zinc-850/60 border border-zinc-800 hover:border-zinc-700 transition-all flex flex-col gap-3 group"
              >
                {/* Top row: Category badge & answers count */}
                <div className="flex items-center justify-between text-xs">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-zinc-800 border border-zinc-750 text-[11px] font-medium text-zinc-300">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    {q.category_name}
                  </span>

                  <span className="flex items-center gap-1 text-[11px] text-zinc-400">
                    <MessageSquare className="w-3 h-3 text-zinc-500" />
                    {q.answer_count} {q.answer_count === 1 ? 'Voice Rut' : 'Voice Ruts'}
                  </span>
                </div>

                {/* Question title */}
                <h3 className="text-sm font-semibold text-zinc-100 leading-snug group-hover:text-amber-200 transition-colors">
                  &ldquo;{q.title}&rdquo;
                </h3>

                {/* Bottom row: author info + record button */}
                <div className="flex items-center justify-between pt-1 border-t border-zinc-800/60 text-xs">
                  <span className="text-[11px] text-zinc-400">Asked by {q.author_name}</span>

                  <button
                    id={`answer-question-btn-${q.id}`}
                    onClick={() => {
                      onSelectQuestionToAnswer(q);
                      onClose();
                    }}
                    className="px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500 text-amber-300 hover:text-zinc-950 font-semibold text-xs flex items-center gap-1.5 transition-all"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    Record Rut
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
