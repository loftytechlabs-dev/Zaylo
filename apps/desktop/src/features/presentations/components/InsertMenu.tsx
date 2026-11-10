import React, { useState, useRef, useEffect } from 'react';
import {
  Plus,
  Type,
  Square,
  Circle,
  ArrowRight,
  Minus,
  MessageSquare,
  Image as ImageIcon,
  Sparkles,
  BarChart2,
  Table as TableIcon,
  Star,
  Shield,
  Zap,
  TrendingUp,
  Users,
  Target,
  Rocket,
  Award,
  ChevronRight,
} from 'lucide-react';
import type { SlideVisualElement, ChartType } from '@local-ai/shared';

interface InsertMenuProps {
  onInsertElement: (element: SlideVisualElement) => void;
  accentColor?: string;
}

export const InsertMenu: React.FC<InsertMenuProps> = ({
  onInsertElement,
  accentColor = '#000000',
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [activeSubmenu, setActiveSubmenu] = useState<'text' | 'shape' | 'chart' | 'icon' | 'table' | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Close on outside click
  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setActiveSubmenu(null);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutside);
    }
    return () => document.removeEventListener('mousedown', handleOutside);
  }, [isOpen]);

  // Insert Text Box
  const handleAddText = (content: string, fontSize: number, bold: boolean) => {
    const id = `el-${Date.now()}`;
    const el: SlideVisualElement = {
      id,
      name: content.slice(0, 20),
      type: 'text',
      transform: { x: 25, y: 35, width: 50, height: 18 },
      text: {
        content,
        style: {
          fontSize,
          bold,
          align: 'left',
          color: '#111111',
        },
      },
    };
    onInsertElement(el);
    setIsOpen(false);
  };

  // Insert Shape
  const handleAddShape = (shapeType: 'rect' | 'roundRect' | 'circle' | 'line' | 'arrow' | 'callout') => {
    const id = `el-${Date.now()}`;
    const isLine = shapeType === 'line' || shapeType === 'arrow';
    const el: SlideVisualElement = {
      id,
      name: `${shapeType} shape`,
      type: 'shape',
      transform: {
        x: 35,
        y: 35,
        width: isLine ? 30 : 25,
        height: isLine ? 2 : 25,
      },
      shape: {
        shapeType,
        fillColor: accentColor + '20',
        borderColor: accentColor,
        borderWidth: 2,
        borderRadius: shapeType === 'roundRect' ? 12 : 0,
      },
    };
    onInsertElement(el);
    setIsOpen(false);
  };

  // Insert Icon
  const handleAddIcon = (iconName: string) => {
    const id = `el-${Date.now()}`;
    const el: SlideVisualElement = {
      id,
      name: `Icon ${iconName}`,
      type: 'icon',
      transform: { x: 45, y: 40, width: 10, height: 10 },
      icon: {
        name: iconName,
        color: accentColor,
        size: 36,
      },
    };
    onInsertElement(el);
    setIsOpen(false);
  };

  // Insert Image from file
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        const id = `el-${Date.now()}`;
        const el: SlideVisualElement = {
          id,
          name: file.name,
          type: 'image',
          transform: { x: 25, y: 20, width: 50, height: 60 },
          image: {
            url: reader.result,
            alt: file.name,
            fit: 'cover',
          },
        };
        onInsertElement(el);
        setIsOpen(false);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // Insert Chart
  const handleAddChart = (chartType: ChartType) => {
    const id = `el-${Date.now()}`;
    const el: SlideVisualElement = {
      id,
      name: `${chartType.toUpperCase()} Chart`,
      type: 'chart',
      transform: { x: 15, y: 20, width: 70, height: 60 },
      chart: {
        type: chartType,
        title: 'Performance Metric Overview',
        subtitle: 'Inserted from Slide Studio',
        theme: 'apple-inspired',
        labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
        series: [{ name: 'Metric', data: [45, 62, 85, 110, 140] }],
        showGrid: true,
        showLegend: true,
      },
    };
    onInsertElement(el);
    setIsOpen(false);
  };

  // Insert Table
  const handleAddTable = (cols: number, rows: number) => {
    const id = `el-${Date.now()}`;
    const headers = Array.from({ length: cols }, (_, i) => `Col ${i + 1}`);
    const tableRows = Array.from({ length: rows }, (_, r) =>
      Array.from({ length: cols }, (_, c) => `R${r + 1} C${c + 1}`)
    );

    const el: SlideVisualElement = {
      id,
      name: `Table (${cols}x${rows})`,
      type: 'table',
      transform: { x: 20, y: 25, width: 60, height: 45 },
      table: {
        headers,
        rows: tableRows,
        hasHeaderRow: true,
      },
    };
    onInsertElement(el);
    setIsOpen(false);
  };

  const ICONS_LIST = [
    { name: 'Star', icon: Star },
    { name: 'Shield', icon: Shield },
    { name: 'Zap', icon: Zap },
    { name: 'TrendingUp', icon: TrendingUp },
    { name: 'Users', icon: Users },
    { name: 'Target', icon: Target },
    { name: 'Rocket', icon: Rocket },
    { name: 'Award', icon: Award },
    { name: 'Sparkles', icon: Sparkles },
  ];

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-8 px-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-[#181818] hover:bg-zinc-100 dark:hover:bg-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 transition-colors flex items-center gap-1.5"
        title="Insert Shape, Text, Image, Table or Chart"
      >
        <Plus className="w-3.5 h-3.5" />
        <span>Insert</span>
      </button>

      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        className="hidden"
      />

      {isOpen && (
        <div className="absolute top-full mt-1.5 left-0 w-48 rounded-xl bg-white dark:bg-[#191919] border border-zinc-200 dark:border-zinc-800 shadow-2xl py-1.5 z-50 text-xs text-zinc-900 dark:text-zinc-100 animate-in fade-in duration-100">
          {/* Text Item */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu('text')}
          >
            <div className="flex items-center justify-between px-3 py-2 hover:bg-zinc-100 dark:hover:bg-[#252528] cursor-pointer">
              <div className="flex items-center gap-2">
                <Type className="w-3.5 h-3.5 text-zinc-500" />
                <span>Text</span>
              </div>
              <ChevronRight className="w-3 h-3 text-zinc-400" />
            </div>

            {activeSubmenu === 'text' && (
              <div className="absolute top-0 left-full ml-1 w-44 rounded-xl bg-white dark:bg-[#191919] border border-zinc-200 dark:border-zinc-800 shadow-xl py-1.5 text-zinc-900 dark:text-zinc-100">
                <button
                  type="button"
                  onClick={() => handleAddText('Headline Text', 32, true)}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-[#262628]"
                >
                  <span className="font-bold text-sm block">Heading</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddText('Subheading context details', 20, false)}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-[#262628]"
                >
                  <span className="font-medium text-xs block">Subheading</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddText('Body paragraph with detailed insights and explanation.', 14, false)}
                  className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-[#262628]"
                >
                  <span className="text-[11px] block">Body Text</span>
                </button>
              </div>
            )}
          </div>

          {/* Shapes Item */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu('shape')}
          >
            <div className="flex items-center justify-between px-3 py-2 hover:bg-zinc-100 dark:hover:bg-[#262628] cursor-pointer">
              <div className="flex items-center gap-2">
                <Square className="w-3.5 h-3.5 text-zinc-500" />
                <span>Shapes</span>
              </div>
              <ChevronRight className="w-3 h-3 text-zinc-400" />
            </div>

            {activeSubmenu === 'shape' && (
              <div className="absolute top-0 left-full ml-1 w-44 rounded-xl bg-white dark:bg-[#1C1C1E] border border-[#EAEAEA] dark:border-[#2A2A2E] shadow-xl py-1.5">
                <button
                  type="button"
                  onClick={() => handleAddShape('rect')}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#262628] flex items-center gap-2"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Rectangle</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddShape('roundRect')}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#262628] flex items-center gap-2"
                >
                  <Square className="w-3.5 h-3.5 rounded" />
                  <span>Rounded Rect</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddShape('circle')}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#262628] flex items-center gap-2"
                >
                  <Circle className="w-3.5 h-3.5" />
                  <span>Circle</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddShape('arrow')}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#262628] flex items-center gap-2"
                >
                  <ArrowRight className="w-3.5 h-3.5" />
                  <span>Arrow</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddShape('line')}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#262628] flex items-center gap-2"
                >
                  <Minus className="w-3.5 h-3.5" />
                  <span>Divider Line</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleAddShape('callout')}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#262628] flex items-center gap-2"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Callout Box</span>
                </button>
              </div>
            )}
          </div>

          {/* Media / Image */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="w-full text-left px-3 py-2 hover:bg-zinc-100 dark:hover:bg-[#262628] flex items-center gap-2"
          >
            <ImageIcon className="w-3.5 h-3.5 text-zinc-500" />
            <span>Upload Image</span>
          </button>

          {/* Icons Item */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu('icon')}
          >
            <div className="flex items-center justify-between px-3 py-2 hover:bg-zinc-100 dark:hover:bg-[#262628] cursor-pointer">
              <div className="flex items-center gap-2">
                <Star className="w-3.5 h-3.5 text-zinc-500" />
                <span>Icons</span>
              </div>
              <ChevronRight className="w-3 h-3 text-zinc-400" />
            </div>

            {activeSubmenu === 'icon' && (
              <div className="absolute top-0 left-full ml-1 w-48 rounded-xl bg-white dark:bg-[#1C1C1E] border border-[#EAEAEA] dark:border-[#2A2A2E] shadow-xl p-2.5">
                <div className="grid grid-cols-3 gap-2">
                  {ICONS_LIST.map(({ name, icon: IconComp }) => (
                    <button
                      key={name}
                      type="button"
                      onClick={() => handleAddIcon(name)}
                      className="p-2.5 rounded-lg border border-transparent hover:border-zinc-300 dark:hover:border-zinc-600 hover:bg-zinc-100 dark:hover:bg-[#262628] flex items-center justify-center transition-all"
                      title={name}
                    >
                      <IconComp className="w-4 h-4" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Charts Item */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu('chart')}
          >
            <div className="flex items-center justify-between px-3 py-2 hover:bg-zinc-100 dark:hover:bg-[#262628] cursor-pointer">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-3.5 h-3.5 text-zinc-500" />
                <span>Chart</span>
              </div>
              <ChevronRight className="w-3 h-3 text-zinc-400" />
            </div>

            {activeSubmenu === 'chart' && (
              <div className="absolute top-0 left-full ml-1 w-44 rounded-xl bg-white dark:bg-[#1C1C1E] border border-[#EAEAEA] dark:border-[#2A2A2E] shadow-xl py-1.5">
                <button
                  type="button"
                  onClick={() => handleAddChart('bar')}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#262628]"
                >
                  Bar Chart
                </button>
                <button
                  type="button"
                  onClick={() => handleAddChart('horizontal-bar')}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#262628]"
                >
                  Horizontal Bar
                </button>
                <button
                  type="button"
                  onClick={() => handleAddChart('line')}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#262628]"
                >
                  Line Chart
                </button>
                <button
                  type="button"
                  onClick={() => handleAddChart('pie')}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#262628]"
                >
                  Pie Chart
                </button>
                <button
                  type="button"
                  onClick={() => handleAddChart('donut')}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#262628]"
                >
                  Donut Chart
                </button>
                <button
                  type="button"
                  onClick={() => handleAddChart('combo')}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#262628]"
                >
                  Combo (Bar+Line)
                </button>
              </div>
            )}
          </div>

          {/* Table Item */}
          <div
            className="relative"
            onMouseEnter={() => setActiveSubmenu('table')}
          >
            <div className="flex items-center justify-between px-3 py-2 hover:bg-zinc-100 dark:hover:bg-[#262628] cursor-pointer">
              <div className="flex items-center gap-2">
                <TableIcon className="w-3.5 h-3.5 text-zinc-500" />
                <span>Table</span>
              </div>
              <ChevronRight className="w-3 h-3 text-zinc-400" />
            </div>

            {activeSubmenu === 'table' && (
              <div className="absolute top-0 left-full ml-1 w-44 rounded-xl bg-white dark:bg-[#1C1C1E] border border-[#EAEAEA] dark:border-[#2A2A2E] shadow-xl py-1.5">
                <button
                  type="button"
                  onClick={() => handleAddTable(3, 3)}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#262628]"
                >
                  3 × 3 Grid
                </button>
                <button
                  type="button"
                  onClick={() => handleAddTable(4, 3)}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#262628]"
                >
                  4 × 3 Grid
                </button>
                <button
                  type="button"
                  onClick={() => handleAddTable(2, 4)}
                  className="w-full text-left px-3 py-1.5 hover:bg-zinc-100 dark:hover:bg-[#262628]"
                >
                  2 × 4 Comparison
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
