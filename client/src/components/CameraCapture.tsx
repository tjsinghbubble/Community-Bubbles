import { useEffect, useRef, useState } from "react";
import { Camera as CameraIcon, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export function CameraCapture({
  open,
  onClose,
  onCapture,
}: {
  open: boolean;
  onClose: () => void;
  onCapture: (file: File) => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!open) return;
    setError(null);
    setReady(false);

    let cancelled = false;
    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "user" },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setReady(true);
      } catch (err: any) {
        if (err?.name === "NotAllowedError") {
          setError("Camera access was denied. Allow camera access in your browser settings and try again.");
        } else if (err?.name === "NotFoundError") {
          setError("No camera was found on this device.");
        } else {
          setError("Couldn't access the camera. Please try again.");
        }
      }
    })();

    return () => {
      cancelled = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    };
  }, [open]);

  const capture = () => {
    const video = videoRef.current;
    if (!video) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const file = new File([blob], `photo-${Date.now()}.jpg`, { type: "image/jpeg" });
      onCapture(file);
    }, "image/jpeg", 0.9);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm overflow-hidden rounded-3xl p-0">
        <DialogHeader className="px-5 pt-5">
          <DialogTitle>Take a Photo</DialogTitle>
        </DialogHeader>
        <div className="relative mt-3 aspect-square w-full bg-black">
          {error ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 px-6 text-center">
              <CameraIcon className="h-8 w-8 text-white/50" />
              <p className="text-[13px] text-white/80" data-testid="text-camera-error">{error}</p>
            </div>
          ) : (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="h-full w-full object-cover"
              data-testid="video-camera-preview"
            />
          )}
        </div>
        <div className="flex items-center justify-center gap-3 p-5">
          <button
            onClick={onClose}
            className="grid h-11 w-11 place-items-center rounded-full border border-black/10 text-foreground/70"
            data-testid="button-camera-cancel"
          >
            <X className="h-5 w-5" />
          </button>
          <button
            onClick={capture}
            disabled={!ready}
            className="grid h-16 w-16 place-items-center rounded-full text-white shadow-lg disabled:opacity-40"
            style={{ background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--brand-2)))" }}
            data-testid="button-camera-capture"
          >
            <CameraIcon className="h-6 w-6" />
          </button>
          <div className="h-11 w-11" aria-hidden />
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** Small dropdown-free trigger pair: shown next to an existing file-picker
 * button to add a "Take Photo" option without changing that button's own
 * click behavior (which stays "choose from library"). */
export function TakePhotoButton({ onClick, className, testId }: { onClick: () => void; className?: string; testId: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={className ?? "grid h-9 w-9 place-items-center rounded-full bg-white shadow ring-1 ring-black/10 text-foreground"}
      data-testid={testId}
    >
      <CameraIcon className="h-4 w-4" />
    </button>
  );
}
