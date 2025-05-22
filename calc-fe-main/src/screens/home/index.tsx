import { ColorSwatch } from '@mantine/core';
import { Button } from '@/components/ui/button';
import '../../index.css';
import { useEffect, useRef, useState, useCallback } from 'react';
import axios from 'axios';
import { Sun, Moon, Undo2, Redo2, Eraser, Pencil, Paintbrush, PaintBucket, X, Bot } from 'lucide-react';
import clsx from "clsx";

const ALL_COLORS = [
    "#000000", "#222222", "#444444", "#666666", "#888888", "#aaaaaa", "#cccccc", "#ffffff",
    "#ee3333", "#e64980", "#be4bdb", "#893200", "#228be6", "#3333ee", "#40c057", "#00aa00",
    "#fab005", "#fd7e14", "#f59e42", "#f7e017", "#17f7e0", "#17aaf7", "#a017f7", "#f717a0"
];
const ALL_SHAPES = [
    { name: "Rectangle", icon: "▭", value: "rectangle" },
    { name: "Circle", icon: "◯", value: "circle" },
    { name: "Line", icon: "/", value: "line" },
    { name: "Arrow", icon: "→", value: "arrow" },
    { name: "Ellipse", icon: "⬭", value: "ellipse" },
    { name: "Triangle", icon: "△", value: "triangle" },
    { name: "Polygon", icon: "⬠", value: "polygon" },
    { name: "Star", icon: "★", value: "star" }
];
const ALL_TOOLS = [
    { name: "Pencil", icon: <Pencil size={18} />, value: "pencil" },
    { name: "Brush", icon: <Paintbrush size={18} />, value: "brush" },
    { name: "Eraser", icon: <Eraser size={18} />, value: "eraser" },
    { name: "Fill", icon: <PaintBucket size={18} />, value: "fill" },
    { name: "Text", icon: "T", value: "text" },
];

interface GeneratedResult {
    expression: string;
    answer: string;
}

interface Response {
    expr: string;
    result: string;
    assign: boolean;
}

type Tool = 'pencil' | 'brush' | 'eraser' | 'fill' | 'rectangle' | 'circle' | 'line' | 'arrow' | 'ellipse' | 'triangle' | 'polygon' | 'star' | 'text' | 'select';

export default function Home() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    const [color, setColor] = useState('#000000');
    const [reset, setReset] = useState(false);
    const [dictOfVars, setDictOfVars] = useState<Record<string, number>>({});
    const [result, setResult] = useState<GeneratedResult>();
    const [latexExpression, setLatexExpression] = useState<string[]>([]);
    const [tool, setTool] = useState<Tool>('pencil');
    const [shape, setShape] = useState<Tool>('rectangle');
    const [lineWidth, setLineWidth] = useState(3);
    const [undoStack, setUndoStack] = useState<ImageData[]>([]);
    const [redoStack, setRedoStack] = useState<ImageData[]>([]);
    const [theme, setTheme] = useState<'light' | 'dark'>('light');
    const [showResult, setShowResult] = useState(false);
    const [textInput, setTextInput] = useState('');
    const [isTextEditing, setIsTextEditing] = useState(false);
    const [textPosition, setTextPosition] = useState<{ x: number, y: number } | null>(null);
    const [shapeStart, setShapeStart] = useState<{ x: number, y: number } | null>(null);
    const [shapePreview, setShapePreview] = useState<ImageData | null>(null);
    const [showTools, setShowTools] = useState(false);
    const [showShapes, setShowShapes] = useState(false);
    const [showColors, setShowColors] = useState(false);
    const [showGemini, setShowGemini] = useState(false);
    const [geminiChat, setGeminiChat] = useState<{ role: string; content: string }[]>([]);
    const [geminiInput, setGeminiInput] = useState('');
    const geminiSuggestions = [
        "Draw a red rectangle",
        "Write Python code for factorial",
        "Solve x^2 + 2x + 1 = 0",
        "Explain Pythagoras theorem",
        "Draw a blue circle",
        "Clear the canvas",
        "Write C++ code for Fibonacci",
        "What is the area of a triangle?",
        "Draw a star",
        "Show me a polygon"
    ];

    useEffect(() => {
        if (theme === 'dark') {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
    }, [theme]);

    useEffect(() => {
        if (latexExpression.length > 0 && window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise();
        }
    }, [latexExpression, lineWidth]);

    useEffect(() => {
        if (reset) {
            resetCanvas();
            setLatexExpression([]);
            setResult(undefined);
            setDictOfVars({});
            setReset(false);
            setUndoStack([]);
            setRedoStack([]);
        }
    }, [reset]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const resize = () => {
            const dpr = window.devicePixelRatio || 1;
            const parent = canvas.parentElement;
            if (!parent) return;
            const rect = parent.getBoundingClientRect();
            if (canvas.width !== rect.width * dpr || canvas.height !== rect.height * dpr) {
                const ctx = canvas.getContext('2d');
                let image: ImageData | null = null;
                if (ctx) {
                    image = ctx.getImageData(0, 0, canvas.width, canvas.height);
                }
                canvas.width = rect.width * dpr;
                canvas.height = rect.height * dpr;
                canvas.style.width = rect.width + 'px';
                canvas.style.height = rect.height + 'px';
                if (ctx) {
                    ctx.setTransform(1, 0, 0, 1, 0, 0);
                    ctx.scale(dpr, dpr);
                    ctx.lineCap = 'round';
                    ctx.lineWidth = lineWidth;
                    if (image) ctx.putImageData(image, 0, 0);
                }
            }
        };
        resize();
        window.addEventListener('resize', resize);
        let observer: ResizeObserver | undefined;
        if (window.ResizeObserver) {
            observer = new ResizeObserver(resize);
            observer.observe(canvas.parentElement!);
        }
        return () => {
            window.removeEventListener('resize', resize);
            if (observer) observer.disconnect();
        };
    }, [lineWidth]);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.lineCap = 'round';
                ctx.lineWidth = lineWidth;
            }
        }
    }, [lineWidth]);

    const saveState = useCallback(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                setUndoStack((prev) => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
                setRedoStack([]); 
            }
        }
    }, []);

    const handleUndo = () => {
        const canvas = canvasRef.current;
        if (canvas && undoStack.length > 0) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const last = undoStack[undoStack.length - 1];
                setRedoStack((prev) => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
                ctx.putImageData(last, 0, 0);
                setUndoStack((prev) => prev.slice(0, -1));
            }
        }
    };

    const handleRedo = () => {
        const canvas = canvasRef.current;
        if (canvas && redoStack.length > 0) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                const last = redoStack[redoStack.length - 1];
                setUndoStack((prev) => [...prev, ctx.getImageData(0, 0, canvas.width, canvas.height)]);
                ctx.putImageData(last, 0, 0);
                setRedoStack((prev) => prev.slice(0, -1));
            }
        }
    };

    const renderLatexToCanvas = useCallback(
        (expression: string, answer: string) => {
            const latex = `\\(\\LARGE{${expression} = ${answer}}\\)`;
            setLatexExpression((prev) => [...prev, latex]);
        },
        []
    );

    useEffect(() => {
        if (result) {
            renderLatexToCanvas(result.expression, result.answer);
        }
    }, [result, renderLatexToCanvas]);

    const resetCanvas = () => {
        const canvas = canvasRef.current;
        if (canvas) {
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    };

    const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return { x: 0, y: 0 };
        const rect = canvas.getBoundingClientRect();
        return {
            x: (e.clientX - rect.left),
            y: (e.clientY - rect.top)
        };
    };

    const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        saveState();
        if (tool === 'fill') {
            const { x, y } = getCanvasCoords(e);
            fillBucket(Math.floor(x), Math.floor(y), color);
            setIsDrawing(false);
            return;
        }
        if (tool === 'rectangle' || tool === 'circle' || tool === 'line' || tool === 'arrow' || tool === 'ellipse' || tool === 'triangle' || tool === 'polygon' || tool === 'star') {
            const { x, y } = getCanvasCoords(e);
            setShapeStart({ x, y });
            setIsDrawing(true);
            setShapePreview(ctx.getImageData(0, 0, canvas.width, canvas.height));
            return;
        }
        if (tool === 'text') {
            const { x, y } = getCanvasCoords(e);
            setTextPosition({ x, y });
            setIsTextEditing(true);
            setIsDrawing(false);
            return;
        }
        const { x, y } = getCanvasCoords(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
    };

    const fillBucket = (x: number, y: number, fillColor: string) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const width = canvas.width;
        const height = canvas.height;
        const imageData = ctx.getImageData(0, 0, width, height);
        const data = imageData.data;

        const hexToRgba = (hex: string) => {
            let c = hex.substring(1);
            if (c.length === 3) c = c.split('').map((x) => x + x).join('');
            const num = parseInt(c, 16);
            return [
                (num >> 16) & 255,
                (num >> 8) & 255,
                num & 255,
                255
            ];
        };

        const targetIdx = (y * width + x) * 4;
        const targetColor = [
            data[targetIdx],
            data[targetIdx + 1],
            data[targetIdx + 2],
            data[targetIdx + 3]
        ];
        const replacementColor = hexToRgba(fillColor);

        const matchColor = (a: number[], b: number[]) =>
            a[0] === b[0] && a[1] === b[1] && a[2] === b[2] && a[3] === b[3];

        if (matchColor(targetColor, replacementColor)) return;

        const stack = [[x, y]];
        const visited = new Set();
        while (stack.length) {
            const [cx, cy] = stack.pop()!;
            if (cx < 0 || cy < 0 || cx >= width || cy >= height) continue;
            const idx = (cy * width + cx) * 4;
            const key = `${cx},${cy}`;
            if (visited.has(key)) continue;
            visited.add(key);
            const currentColor = [
                data[idx],
                data[idx + 1],
                data[idx + 2],
                data[idx + 3]
            ];
            if (matchColor(currentColor, targetColor)) {
                data[idx] = replacementColor[0];
                data[idx + 1] = replacementColor[1];
                data[idx + 2] = replacementColor[2];
                data[idx + 3] = replacementColor[3];
                stack.push([cx - 1, cy]);
                stack.push([cx + 1, cy]);
                stack.push([cx, cy - 1]);
                stack.push([cx, cy + 1]);
            }
        }
        ctx.putImageData(imageData, 0, 0);
    };

    const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
        if (!isDrawing) return;
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.lineWidth = tool === 'brush' ? lineWidth * 2 : lineWidth;
        ctx.strokeStyle = tool === 'eraser' ? (theme === 'dark' ? '#222' : '#fff') : color;
        const { x, y } = getCanvasCoords(e);

        if ((tool === 'rectangle' || tool === 'circle' || tool === 'line' || tool === 'arrow' || tool === 'ellipse' || tool === 'triangle' || tool === 'polygon' || tool === 'star') && shapeStart && shapePreview) {
            ctx.putImageData(shapePreview, 0, 0);
            ctx.beginPath();
            if (tool === 'rectangle') {
                ctx.strokeRect(shapeStart.x, shapeStart.y, x - shapeStart.x, y - shapeStart.y);
            } else if (tool === 'circle') {
                const radius = Math.sqrt(Math.pow(x - shapeStart.x, 2) + Math.pow(y - shapeStart.y, 2));
                ctx.arc(shapeStart.x, shapeStart.y, radius, 0, 2 * Math.PI);
                ctx.stroke();
            } else if (tool === 'ellipse') {
                ctx.save();
                ctx.beginPath();
                ctx.ellipse(
                    (shapeStart.x + x) / 2,
                    (shapeStart.y + y) / 2,
                    Math.abs(x - shapeStart.x) / 2,
                    Math.abs(y - shapeStart.y) / 2,
                    0, 0, 2 * Math.PI
                );
                ctx.stroke();
                ctx.restore();
            } else if (tool === 'triangle') {
                ctx.beginPath();
                ctx.moveTo(shapeStart.x, y);
                ctx.lineTo((shapeStart.x + x) / 2, shapeStart.y);
                ctx.lineTo(x, y);
                ctx.closePath();
                ctx.stroke();
            } else if (tool === 'polygon') {
                const sides = 5;
                const cx = (shapeStart.x + x) / 2;
                const cy = (shapeStart.y + y) / 2;
                const rx = Math.abs(x - shapeStart.x) / 2;
                const ry = Math.abs(y - shapeStart.y) / 2;
                ctx.beginPath();
                for (let i = 0; i < sides; i++) {
                    const theta = (2 * Math.PI * i) / sides - Math.PI / 2;
                    const px = cx + rx * Math.cos(theta);
                    const py = cy + ry * Math.sin(theta);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.stroke();
            } else if (tool === 'star') {
                const cx = (shapeStart.x + x) / 2;
                const cy = (shapeStart.y + y) / 2;
                const spikes = 5;
                const outerRadius = Math.max(Math.abs(x - shapeStart.x) / 2, 10);
                const innerRadius = outerRadius / 2.5;
                let rot = Math.PI / 2 * 3;
                const step = Math.PI / spikes;
                ctx.beginPath();
                ctx.moveTo(cx, cy - outerRadius);
                for (let i = 0; i < spikes; i++) {
                    ctx.lineTo(
                        cx + Math.cos(rot) * outerRadius,
                        cy + Math.sin(rot) * outerRadius
                    );
                    rot += step;
                    ctx.lineTo(
                        cx + Math.cos(rot) * innerRadius,
                        cy + Math.sin(rot) * innerRadius
                    );
                    rot += step;
                }
                ctx.lineTo(cx, cy - outerRadius);
                ctx.closePath();
                ctx.stroke();
            } else if (tool === 'line') {
                ctx.moveTo(shapeStart.x, shapeStart.y);
                ctx.lineTo(x, y);
                ctx.stroke();
            } else if (tool === 'arrow') {
                ctx.moveTo(shapeStart.x, shapeStart.y);
                ctx.lineTo(x, y);
                ctx.stroke();
                const angle = Math.atan2(y - shapeStart.y, x - shapeStart.x);
                const headlen = 10 + lineWidth;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x - headlen * Math.cos(angle - Math.PI / 6), y - headlen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(x, y);
                ctx.lineTo(x - headlen * Math.cos(angle + Math.PI / 6), y - headlen * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
            }
            return;
        }
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDrawing = (e?: React.MouseEvent<HTMLCanvasElement>) => {
        setIsDrawing(false);
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        if ((tool === 'rectangle' || tool === 'circle' || tool === 'line' || tool === 'arrow' || tool === 'ellipse' || tool === 'triangle' || tool === 'polygon' || tool === 'star') && shapeStart && shapePreview && e) {
            ctx.putImageData(shapePreview, 0, 0);
            ctx.beginPath();
            const { x, y } = getCanvasCoords(e);
            if (tool === 'rectangle') {
                ctx.strokeRect(shapeStart.x, shapeStart.y, x - shapeStart.x, y - shapeStart.y);
            } else if (tool === 'circle') {
                const radius = Math.sqrt(Math.pow(x - shapeStart.x, 2) + Math.pow(y - shapeStart.y, 2));
                ctx.arc(shapeStart.x, shapeStart.y, radius, 0, 2 * Math.PI);
                ctx.stroke();
            } else if (tool === 'ellipse') {
                ctx.save();
                ctx.beginPath();
                ctx.ellipse(
                    (shapeStart.x + x) / 2,
                    (shapeStart.y + y) / 2,
                    Math.abs(x - shapeStart.x) / 2,
                    Math.abs(y - shapeStart.y) / 2,
                    0, 0, 2 * Math.PI
                );
                ctx.stroke();
                ctx.restore();
            } else if (tool === 'triangle') {
                ctx.beginPath();
                ctx.moveTo(shapeStart.x, y);
                ctx.lineTo((shapeStart.x + x) / 2, shapeStart.y);
                ctx.lineTo(x, y);
                ctx.closePath();
                ctx.stroke();
            } else if (tool === 'polygon') {
                const sides = 5;
                const cx = (shapeStart.x + x) / 2;
                const cy = (shapeStart.y + y) / 2;
                const rx = Math.abs(x - shapeStart.x) / 2;
                const ry = Math.abs(y - shapeStart.y) / 2;
                ctx.beginPath();
                for (let i = 0; i < sides; i++) {
                    const theta = (2 * Math.PI * i) / sides - Math.PI / 2;
                    const px = cx + rx * Math.cos(theta);
                    const py = cy + ry * Math.sin(theta);
                    if (i === 0) ctx.moveTo(px, py);
                    else ctx.lineTo(px, py);
                }
                ctx.closePath();
                ctx.stroke();
            } else if (tool === 'star') {
                const cx = (shapeStart.x + x) / 2;
                const cy = (shapeStart.y + y) / 2;
                const spikes = 5;
                const outerRadius = Math.max(Math.abs(x - shapeStart.x) / 2, 10);
                const innerRadius = outerRadius / 2.5;
                let rot = Math.PI / 2 * 3;
                const step = Math.PI / spikes;
                ctx.beginPath();
                ctx.moveTo(cx, cy - outerRadius);
                for (let i = 0; i < spikes; i++) {
                    ctx.lineTo(
                        cx + Math.cos(rot) * outerRadius,
                        cy + Math.sin(rot) * outerRadius
                    );
                    rot += step;
                    ctx.lineTo(
                        cx + Math.cos(rot) * innerRadius,
                        cy + Math.sin(rot) * innerRadius
                    );
                    rot += step;
                }
                ctx.lineTo(cx, cy - outerRadius);
                ctx.closePath();
                ctx.stroke();
            } else if (tool === 'line') {
                ctx.moveTo(shapeStart.x, shapeStart.y);
                ctx.lineTo(x, y);
                ctx.stroke();
            } else if (tool === 'arrow') {
                ctx.moveTo(shapeStart.x, shapeStart.y);
                ctx.lineTo(x, y);
                ctx.stroke();
                const angle = Math.atan2(y - shapeStart.y, x - shapeStart.x);
                const headlen = 10 + lineWidth;
                ctx.beginPath();
                ctx.moveTo(x, y);
                ctx.lineTo(x - headlen * Math.cos(angle - Math.PI / 6), y - headlen * Math.sin(angle - Math.PI / 6));
                ctx.moveTo(x, y);
                ctx.lineTo(x - headlen * Math.cos(angle + Math.PI / 6), y - headlen * Math.sin(angle + Math.PI / 6));
                ctx.stroke();
            }
            setShapeStart(null);
            setShapePreview(null);
            saveState();
        }
    };

    function isCanvasBlank(canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext('2d');
        if (!ctx) return true;
        const pixelBuffer = new Uint32Array(
            ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
        );
        return !pixelBuffer.some(color => color !== 0);
    }

    const runRoute = async (): Promise<void> => {
        const canvas = canvasRef.current;
        if (canvas) {
            if (isCanvasBlank(canvas)) {
                alert('Canvas is blank. Please draw something before running.');
                return;
            }
            try {
                const response = await axios.post<{ data: Response[] }>(
                    `${import.meta.env.VITE_API_URL}/calculate`,
                    {
                        image: canvas.toDataURL('image/png'),
                        dict_of_vars: dictOfVars,
                    }
                );
                const resp = response.data;
                resp.data.forEach((data: Response) => {
                    if (data.assign === true) {
                        setDictOfVars((prev) => ({
                            ...prev,
                            [data.expr]: parseFloat(data.result),
                        }));
                    }
                });

                const ctx = canvas.getContext('2d');
                const imageData = ctx!.getImageData(0, 0, canvas.width, canvas.height);
                let minX = canvas.width, minY = canvas.height, maxX = 0, maxY = 0;

                for (let y = 0; y < canvas.height; y++) {
                    for (let x = 0; x < canvas.width; x++) {
                        const i = (y * canvas.width + x) * 4;
                        if (imageData.data[i + 3] > 0) {
                            minX = Math.min(minX, x);
                            minY = Math.min(minY, y);
                            maxX = Math.max(maxX, x);
                            maxY = Math.max(maxY, y);
                        }
                    }
                }

                setShowResult(true);

                resp.data.forEach((data: Response) => {
                    setTimeout(() => {
                        setResult({
                            expression: data.expr,
                            answer: data.result,
                        });
                    }, 1000);
                });
            } catch {
                alert('Failed to process the image. Please try again.');
            }
        }
    };

    const handleGeminiChat = async (e: React.FormEvent) => {
        e.preventDefault();
        setGeminiChat(prev => [...prev, { role: "user", content: geminiInput }]);
        try {
            const response = await axios.post<{ result: string }>(
                `${import.meta.env.VITE_API_URL}/search`,
                { query: geminiInput }
            );
            setGeminiChat(prev => [...prev, { role: "gemini", content: response.data.result }]);
            setGeminiInput('');
        } catch {
            setGeminiChat(prev => [...prev, { role: "gemini", content: "Sorry, I couldn't answer that." }]);
        }
    };

    const ToolbarPopover = ({ open, setOpen, children, label }: { open: boolean, setOpen: (b: boolean) => void, children: React.ReactNode, label: string }) => (
        <div className="relative">
            <Button
                variant="outline"
                className="rounded-xl px-3 py-1 bg-white/60 shadow border border-primary/10 hover:bg-white/80 transition-all"
                onClick={() => setOpen(!open)}
            >
                {label}
            </Button>
            {open && (
                <div className="absolute left-0 mt-2 min-w-[180px] bg-white/80 rounded-xl border border-primary/10 shadow-xl z-50 p-2 animate-fade-in"
                    style={{backdropFilter: "blur(12px)"}}
                >
                    {children}
                </div>
            )}
        </div>
    );

    return (
        <div className={clsx(
            "relative min-h-screen bg-gradient-to-br from-white via-blue-50 to-blue-100 dark:from-[#181c24] dark:to-[#23283b] text-foreground transition-colors",
            "backdrop-blur-xl"
        )}>
            <div className="fixed top-0 left-0 w-full flex justify-between items-center z-50 p-3 px-6 bg-white/60 dark:bg-black/30 backdrop-blur-xl border-b border-primary/10 shadow-sm">
                <span className="text-2xl font-bold text-primary tracking-wide drop-shadow-lg" style={{letterSpacing: 2}}>MathScribe</span>
                <Button variant="outline" className="rounded-full px-3 py-1 flex gap-2 items-center bg-white/60 shadow border border-primary/10 hover:bg-white/80 transition-all"
                    onClick={() => setShowGemini(true)}
                >
                    <Bot size={18} /> Gemini
                </Button>
            </div>
            {showGemini && (
                <div className="fixed top-0 right-0 h-full w-[360px] bg-white/90 dark:bg-[#23283b]/90 shadow-2xl border-l border-primary/10 z-[100] flex flex-col animate-fade-in">
                    <div className="flex items-center justify-between p-4 border-b border-primary/10">
                        <span className="font-bold text-lg text-primary">Gemini Chatbot</span>
                        <button onClick={() => setShowGemini(false)}><X /></button>
                    </div>
                    <div className="p-4 border-b border-primary/10">
                        <div className="font-semibold mb-2 text-primary">Suggestions & Ideas</div>
                        <div className="flex flex-wrap gap-2">
                            {geminiSuggestions.map((s, i) => (
                                <button
                                    key={i}
                                    className="px-2 py-1 rounded-lg bg-primary/10 text-primary text-xs hover:bg-primary/20 transition"
                                    onClick={() => setGeminiInput(s)}
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    </div>
                    <div className="flex-1 overflow-y-auto p-4 space-y-2">
                        {geminiChat.map((msg, i) => (
                            <div key={i} className={msg.role === "user" ? "text-right" : "text-left"}>
                                <span className={msg.role === "user" ? "bg-blue-100 text-blue-900 px-2 py-1 rounded-xl inline-block" : "bg-primary/10 text-primary px-2 py-1 rounded-xl inline-block"}>
                                    {msg.content}
                                </span>
                            </div>
                        ))}
                    </div>
                    <form onSubmit={handleGeminiChat} className="p-4 flex gap-2 border-t border-primary/10">
                        <input
                            value={geminiInput}
                            onChange={e => setGeminiInput(e.target.value)}
                            className="flex-1 rounded-lg border border-primary/10 px-3 py-2 bg-white/80"
                            placeholder="Ask Gemini anything..."
                        />
                        <Button type="submit" variant="default">Send</Button>
                    </form>
                </div>
            )}
            <div className="fixed top-20 left-1/2 transform -translate-x-1/2 z-40 flex gap-4 p-3 rounded-2xl shadow-xl bg-white/70 dark:bg-[#23283b]/80 border border-primary/10 backdrop-blur-xl">
                <ToolbarPopover open={showTools} setOpen={setShowTools} label="Tools">
                    <div className="flex flex-wrap gap-2">
                        {ALL_TOOLS.map(t => (
                            <Button key={t.value} variant={tool === t.value ? 'secondary' : 'outline'} className="p-2 rounded-lg" onClick={() => { setTool(t.value as Tool); setShowTools(false); }}>
                                {t.icon}
                            </Button>
                        ))}
                        <div className="flex items-center gap-2 mt-2 w-full">
                            <span className="text-xs">Size</span>
                            <input
                                type="range"
                                min={1}
                                max={30}
                                value={lineWidth}
                                onChange={e => setLineWidth(Number(e.target.value))}
                                className="accent-primary"
                                style={{width: 70}}
                            />
                            <span className="text-xs">{lineWidth}px</span>
                        </div>
                    </div>
                </ToolbarPopover>
                <ToolbarPopover open={showShapes} setOpen={setShowShapes} label="Shapes">
                    <div className="flex flex-wrap gap-2">
                        {ALL_SHAPES.map(s => (
                            <Button key={s.value} variant={shape === s.value ? 'secondary' : 'outline'} className="p-2 rounded-lg" onClick={() => { setShape(s.value as Tool); setTool(s.value as Tool); setShowShapes(false); }}>
                                {s.icon}
                            </Button>
                        ))}
                    </div>
                </ToolbarPopover>
                <ToolbarPopover open={showColors} setOpen={setShowColors} label="Colors">
                    <div className="flex flex-wrap gap-1 max-w-xs">
                        {ALL_COLORS.map(swatch => (
                            <ColorSwatch
                                key={swatch}
                                color={swatch}
                                onClick={() => { setColor(swatch); setShowColors(false); }}
                                style={{
                                    border: color === swatch ? '2px solid #333' : undefined,
                                    cursor: 'pointer',
                                    boxShadow: color === swatch ? "0 0 0 2px #333" : undefined,
                                    transition: 'box-shadow 0.2s, border 0.2s'
                                }}
                            />
                        ))}
                    </div>
                </ToolbarPopover>
                <Button onClick={() => setReset(true)} className="bg-destructive text-destructive-foreground rounded-xl px-4 shadow transition-all" variant="destructive">
                    Reset
                </Button>
                <Button onClick={runRoute} className="bg-primary text-primary-foreground rounded-xl px-4 shadow transition-all" variant="default">
                    Run
                </Button>
                <Button onClick={handleUndo} disabled={undoStack.length === 0} variant="outline" className="flex items-center gap-1 rounded-xl px-3 shadow transition-all">
                    <Undo2 size={18} /> Undo
                </Button>
                <Button onClick={handleRedo} disabled={redoStack.length === 0} variant="outline" className="flex items-center gap-1 rounded-xl px-3 shadow transition-all">
                    <Redo2 size={18} /> Redo
                </Button>
                <Button
                    onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    variant="outline"
                    className="ml-2 rounded-xl px-3 shadow transition-all"
                    title="Toggle Theme"
                >
                    {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </Button>
            </div>
            <div
                className="fixed left-0 w-full"
                style={{
                    top: 92, // toolbar height (top-20 + padding)
                    bottom: 0,
                    height: 'auto',
                    zIndex: 10,
                }}
            >
                <div className="relative w-full h-full" style={{ height: "100%" }}>
                    <canvas
                        ref={canvasRef}
                        id="canvas"
                        className="absolute top-0 left-0 w-full h-full z-10 rounded-2xl border border-primary/20 shadow-xl"
                        onMouseDown={startDrawing}
                        onMouseMove={draw}
                        onMouseUp={stopDrawing}
                        onMouseOut={stopDrawing}
                        style={{
                            cursor: tool === 'eraser' ? 'cell' : tool === 'fill' ? 'crosshair' : tool === 'text' ? 'text' : 'crosshair',
                            background: "rgba(255,255,255,0.85)",
                            transition: "box-shadow 0.2s, border 0.2s",
                            width: "100%",
                            height: "100%",
                            display: "block"
                        }}
                    />
                    {isTextEditing && textPosition && (
                        <div
                            style={{
                                position: 'absolute',
                                left: textPosition.x,
                                top: textPosition.y,
                                zIndex: 20,
                                background: 'rgba(255,255,255,0.9)',
                                padding: 4,
                                borderRadius: 4,
                                boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
                                animation: "fadeIn .3s"
                            }}
                        >
                            <input
                                type="text"
                                value={textInput}
                                onChange={e => setTextInput(e.target.value)}
                                onBlur={handleTextSubmit}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') handleTextSubmit();
                                }}
                                autoFocus
                                style={{ fontSize: 18, minWidth: 100 }}
                            />
                        </div>
                    )}
                </div>
            </div>
            {showResult && (
                <div className="fixed inset-0 flex items-center justify-center z-50">
                    <div className="absolute inset-0 bg-black bg-opacity-40"></div>
                    <div className="bg-card rounded-lg shadow-2xl p-8 min-w-[320px] max-w-lg relative border-2 border-primary animate-fade-in">
                        <button
                            className="absolute top-2 right-2 text-2xl font-bold text-gray-400 hover:text-primary transition-colors"
                            onClick={() => setShowResult(false)}
                            aria-label="Close"
                        >
                            ×
                        </button>
                        <h2 className="text-xl font-bold mb-4 text-primary">Result</h2>
                        {result ? (
                            <div className="mb-4 p-3 text-white rounded shadow bg-black/80 w-full text-lg">
                                <div className="text-white" style={{ whiteSpace: 'pre-line' }}>
                                    {result.expression} = {result.answer}
                                </div>
                            </div>
                        ) : (
                            <div className="text-muted-foreground">No result yet.</div>
                        )}
                    </div>
                </div>
            )}
            <style>{`
                @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
                @keyframes fadeInUp { from { opacity: 0; transform: translateY(40px);} to { opacity: 1; transform: none;} }
                @keyframes slideDown { from { opacity: 0; transform: translateY(-40px);} to { opacity: 1; transform: none;} }
            `}</style>
        </div>
    );
}
