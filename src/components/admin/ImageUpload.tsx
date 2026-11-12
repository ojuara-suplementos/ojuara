import { ChangeEvent, useRef, useState } from "react";
import { Loader2, Upload, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";

interface Props {
  value: string;
  onChange: (url: string) => void;
  /** Chamado apenas quando um novo arquivo é enviado ao storage nesta sessão. */
  onUploaded?: (url: string) => void;
}

const BUCKET = "products";
const MAX_SIZE_KB = 800;

async function compressImage(file: File, maxSizeKB: number = MAX_SIZE_KB): Promise<File> {
  const maxBytes = maxSizeKB * 1024;
  if (file.size <= maxBytes) return file;

  const image = await createImageBitmap(file);
  const maxDimension = 1920;
  let { width, height } = image;
  if (width > maxDimension || height > maxDimension) {
    const scale = Math.min(maxDimension / width, maxDimension / height);
    width = Math.round(width * scale);
    height = Math.round(height * scale);
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível criar canvas");
  ctx.drawImage(image, 0, 0, width, height);
  image.close();

  const isJpeg = file.type === "image/jpeg" || file.type === "image/jpg";
  const type = isJpeg ? "image/jpeg" : "image/webp";
  const ext = isJpeg ? "jpg" : "webp";

  let quality = 0.92;
  let blob: Blob | null = null;
  while (quality > 0.1) {
    blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, type, quality)
    );
    if (blob && blob.size <= maxBytes) break;
    quality -= 0.1;
  }

  if (!blob || blob.size > maxBytes) {
    throw new Error(`Não foi possível reduzir a imagem abaixo de ${maxSizeKB}KB`);
  }

  const name = `${file.name.replace(/\.[^/.]+$/, "")}.${ext}`;
  return new File([blob], name, { type: blob.type });
}

export function ImageUpload({ value, onChange, onUploaded }: Props) {
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const compressed = await compressImage(file);
      const ext = compressed.name.split(".").pop() ?? "jpg";
      const path = `variants/${crypto.randomUUID()}.${ext}`;

      const { error } = await supabase.storage.from(BUCKET).upload(path, compressed, {
        cacheControl: "3600",
        upsert: false,
        contentType: compressed.type,
      });
      if (error) {
        toast({
          title: "Falha ao enviar",
          description: error.message,
          variant: "destructive",
        });
        setUploading(false);
        return;
      }
      const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
      onUploaded?.(data.publicUrl);
      onChange(data.publicUrl);
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Erro ao processar imagem";
      toast({ title: "Falha no envio", description: message, variant: "destructive" });
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex gap-2 items-start">
        {value ? (
          <div className="relative h-20 w-20 shrink-0 rounded-md overflow-hidden border border-border bg-muted">
            <img src={value} alt="preview" className="h-full w-full object-cover" />
            <button
              type="button"
              onClick={() => onChange("")}
              className="absolute top-1 right-1 bg-background/80 rounded p-0.5"
              aria-label="Remover"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <div className="h-20 w-20 shrink-0 rounded-md border border-dashed border-border grid place-items-center text-muted-foreground">
            <Upload className="h-5 w-5" />
          </div>
        )}
        <div className="flex-1 space-y-2">
          <Input
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://... ou envie uma imagem"
          />
          <div className="flex gap-2">
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Upload className="h-4 w-4 mr-2" />
              )}
              Enviar imagem
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
