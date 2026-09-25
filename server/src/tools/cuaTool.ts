import { mouseController } from '../cua/mouseController.js';
import { keyboardController } from '../cua/keyboardController.js';

export interface CuaActionArgs {
  action: 'move' | 'click' | 'drag' | 'type' | 'shortcut' | 'position';
  x?: number;
  y?: number;
  fromX?: number;
  fromY?: number;
  toX?: number;
  toY?: number;
  button?: 'left' | 'right' | 'middle';
  count?: 1 | 2;
  text?: string;
  shortcut?: string;
}

export interface CuaActionResult {
  success: boolean;
  message: string;
  position?: { x: number; y: number };
}

export async function executeCuaAction(args: CuaActionArgs): Promise<CuaActionResult> {
  try {
    switch (args.action) {
      case 'move':
        if (args.x === undefined || args.y === undefined) {
          return { success: false, message: 'x and y coordinates are required for move action.' };
        }
        await mouseController.moveTo(args.x, args.y, true);
        return { success: true, message: `Moved cursor to (${args.x}, ${args.y}).` };

      case 'click':
        await mouseController.click(args.x, args.y, args.button || 'left', args.count || 1);
        return { success: true, message: `Clicked ${args.button || 'left'} button${args.count === 2 ? ' twice' : ''}.` };

      case 'drag':
        if (args.fromX === undefined || args.fromY === undefined || args.toX === undefined || args.toY === undefined) {
          return { success: false, message: 'fromX, fromY, toX, and toY are required for drag.' };
        }
        await mouseController.drag(args.fromX, args.fromY, args.toX, args.toY);
        return { success: true, message: `Dragged cursor from (${args.fromX}, ${args.fromY}) to (${args.toX}, ${args.toY}).` };

      case 'type':
        if (!args.text) {
          return { success: false, message: 'text parameter is required for type action.' };
        }
        await keyboardController.typeText(args.text);
        return { success: true, message: `Typed "${args.text}".` };

      case 'shortcut':
        if (!args.shortcut) {
          return { success: false, message: 'shortcut parameter is required.' };
        }
        await keyboardController.shortcut(args.shortcut);
        return { success: true, message: `Executed shortcut chord "${args.shortcut}".` };

      case 'position':
      default: {
        const pos = await mouseController.getPosition();
        return { success: true, message: `Current cursor position is (${pos.x}, ${pos.y}).`, position: pos };
      }
    }
  } catch (err: any) {
    return { success: false, message: `CUA Action failed: ${err.message}` };
  }
}
