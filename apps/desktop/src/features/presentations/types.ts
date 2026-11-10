export type SelectionType =
  | 'none'
  | 'slide'
  | 'title'
  | 'subtitle'
  | 'kicker'
  | 'bullet'
  | 'card'
  | 'stat'
  | 'swot'
  | 'custom';

export interface SelectionTarget {
  type: SelectionType;
  elementId?: string;
  subIndex?: number;
  swotKey?: 'strengths' | 'weaknesses' | 'opportunities' | 'threats';
}

export type EditorViewMode = 'default' | 'distraction-free' | 'present';

export interface DragOperation {
  elementId: string;
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
}

export interface ResizeOperation {
  elementId: string;
  handle: 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';
  startX: number;
  startY: number;
  initialX: number;
  initialY: number;
  initialW: number;
  initialH: number;
}
