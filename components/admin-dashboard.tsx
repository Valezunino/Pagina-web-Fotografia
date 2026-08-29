"use client";

import { FormEvent, useRef, useState } from "react";
import { upload } from "@vercel/blob/client";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  EyeOff,
  FolderOpen,
  FolderPlus,
  ImagePlus,
  KeyRound,
  LoaderCircle,
  LogOut,
  Palette,
  Save,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import type { EditableSiteSettings } from "@/lib/site-settings";

type AdminPhoto = {
  id: string;
  albumId: string | null;
  title: string;
  category: string;
  priceCents: number;
  published: boolean;
  sortOrder: number;
};

type AdminAlbum = {
  id: string;
  slug: string;
  title: string;
  description: string;
  published: boolean;
  sortOrder: number;
};

async function makePreview(original: File, logo: File | null, watermarkText: string) {
  const source = await createImageBitmap(original);
  const maximum = 1600;
  const ratio = Math.min(1, maximum / Math.max(source.width, source.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(source.width * ratio);
  canvas.height = Math.round(source.height * ratio);
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Tu navegador no pudo preparar la vista protegida.");
  context.drawImage(source, 0, 0, canvas.width, canvas.height);
  context.fillStyle = "rgb(0 0 0 / 0.18)";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.save();
  context.globalAlpha = 0.56;
  context.translate(canvas.width / 2, canvas.height / 2);
  context.rotate(-Math.PI / 24);

  if (logo) {
    const logoBitmap = await createImageBitmap(logo);
    const logoRatio = logoBitmap.height / logoBitmap.width;
    const targetWidth = Math.min(
      canvas.width * 0.72,
      (canvas.height * 0.72) / logoRatio,
    );
    const targetHeight = targetWidth * (logoBitmap.height / logoBitmap.width);
    context.drawImage(
      logoBitmap,
      -targetWidth / 2,
      -targetHeight / 2,
      targetWidth,
      targetHeight,
    );
    logoBitmap.close();
  } else {
    const size = Math.max(18, Math.round(canvas.width / 24));
    context.font = `700 ${size}px Arial`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillStyle = "white";
    context.strokeStyle = "rgb(0 0 0 / 0.7)";
    context.lineWidth = Math.max(2, size / 12);
    context.strokeText(watermarkText.toUpperCase(), 0, 0);
    context.fillText(watermarkText.toUpperCase(), 0, 0);
  }
  context.restore();
  source.close();

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("No pudimos crear la vista protegida."))),
      "image/jpeg",
      0.84,
    );
  });
}

function nameFromFile(file: File) {
  return file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").trim() || "Fotografía";
}

async function apiError(response: Response, fallback: string) {
  const text = await response.text();
  try {
    const data = JSON.parse(text) as { error?: string };
    return data.error ?? fallback;
  } catch {
    return response.status === 413
      ? "La parte del archivo es demasiado grande."
      : fallback;
  }
}

function safeFilename(filename: string) {
  const normalized = filename.normalize("NFKD").replace(/[^a-zA-Z0-9._-]+/g, "-");
  return normalized.slice(-120) || "fotografia-original.jpg";
}

export function AdminDashboard({
  initialPhotos,
  initialAlbums,
  initialSettings,
  initialAdminEmail,
}: {
  initialPhotos: AdminPhoto[];
  initialAlbums: AdminAlbum[];
  initialSettings: EditableSiteSettings;
  initialAdminEmail: string;
}) {
  const uploadFormRef = useRef<HTMLFormElement>(null);
  const [photos, setPhotos] = useState<AdminPhoto[]>(initialPhotos);
  const [albums, setAlbums] = useState<AdminAlbum[]>(initialAlbums);
  const [selectedAlbumId, setSelectedAlbumId] = useState(initialAlbums[0]?.id ?? "unassigned");
  const [settings, setSettings] = useState(initialSettings);
  const [uploading, setUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [watermarking, setWatermarking] = useState(false);
  const [watermarkMessage, setWatermarkMessage] = useState("");
  const [settingsMessage, setSettingsMessage] = useState("");
  const [adminEmail, setAdminEmail] = useState(initialAdminEmail);
  const [emailMessage, setEmailMessage] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");
  const [albumMessage, setAlbumMessage] = useState("");
  const selectedAlbum = albums.find((album) => album.id === selectedAlbumId);
  const selectedPhotos = photos.filter((photo) => selectedAlbumId === "unassigned" ? !photo.albumId : photo.albumId === selectedAlbumId);
  const visiblePhotos = selectedPhotos.filter((photo) => photo.published).length;
  const hiddenPhotos = selectedPhotos.length - visiblePhotos;

  async function loadPhotos() {
    const response = await fetch("/api/admin/photos", { cache: "no-store" });
    if (response.ok) {
      const data = (await response.json()) as { photos: AdminPhoto[] };
      setPhotos(data.photos);
    }
  }

  async function createAlbum(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAlbumMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/admin/albums", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: form.get("albumTitle"), description: form.get("albumDescription") }),
    });
    const data = (await response.json()) as { album?: AdminAlbum; error?: string };
    if (!response.ok || !data.album) {
      setAlbumMessage(data.error ?? "No pudimos crear la carpeta.");
      return;
    }
    setAlbums((current) => [...current, data.album!]);
    setSelectedAlbumId(data.album.id);
    setAlbumMessage("Carpeta creada. Ya podés subir las fotos del evento.");
    event.currentTarget.reset();
  }

  async function updateAlbum(id: string, changes: { title?: string; description?: string; published?: boolean }) {
    const response = await fetch(`/api/admin/albums/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const data = (await response.json()) as { album?: AdminAlbum; error?: string };
    if (!response.ok || !data.album) throw new Error(data.error ?? "No pudimos guardar la carpeta.");
    setAlbums((current) => current.map((album) => album.id === id ? data.album! : album));
  }

  async function deleteAlbum(id: string) {
    const response = await fetch(`/api/admin/albums/${id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error ?? "No pudimos eliminar la carpeta.");
    const remaining = albums.filter((album) => album.id !== id);
    setAlbums(remaining);
    setSelectedAlbumId(remaining[0]?.id ?? "unassigned");
  }

  async function moveAlbum(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= albums.length) return;
    const previous = albums;
    const reordered = [...albums];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    setAlbums(reordered);
    const response = await fetch("/api/admin/album-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((album) => album.id) }),
    });
    if (!response.ok) setAlbums(previous);
  }

  async function uploadPhotos(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setUploading(true);
    setUploadMessage("");
    try {
      const sourceForm = new FormData(event.currentTarget);
      const albumId = String(sourceForm.get("albumId") || "");
      if (!albumId || albumId === "unassigned") throw new Error("Primero elegí o creá la carpeta del evento.");
      const originals = sourceForm
        .getAll("originals")
        .filter((value): value is File => value instanceof File && value.size > 0);
      if (!originals.length) throw new Error("Seleccioná una o varias fotos originales.");
      if (originals.some((file) => file.size > 25 * 1024 * 1024)) {
        throw new Error("Cada archivo original puede pesar hasta 25 MB.");
      }

      let logo = sourceForm.get("logo");
      if (!(logo instanceof File) || !logo.size) {
        const response = await fetch("/brand/daniel-fotografia-watermark.png");
        const blob = await response.blob();
        logo = new File([blob], "daniel-fotografia-watermark.png", { type: "image/png" });
      }

      const titleBase = String(sourceForm.get("title") || "").trim();
      const category = String(sourceForm.get("category") || "Fotografía").trim();
      const price = String(sourceForm.get("price") || "");

      for (let index = 0; index < originals.length; index += 1) {
        const original = originals[index];
        setUploadMessage(`Preparando y publicando ${index + 1} de ${originals.length}…`);
        const preview = await makePreview(original, logo, settings.watermarkText);
        const derivedTitle = titleBase
          ? originals.length > 1
            ? `${titleBase} ${index + 1}`
            : titleBase
          : nameFromFile(original);

        const uploadId = crypto.randomUUID();

        setUploadMessage(`Enviando ${index + 1} de ${originals.length} sin perder calidad…`);
        const previewBlob = await upload(`previews/${uploadId}.jpg`, preview, {
          access: "private",
          handleUploadUrl: "/api/admin/uploads/blob",
          clientPayload: JSON.stringify({ uploadId, kind: "preview" }),
          contentType: "image/jpeg",
        });
        const originalBlob = await upload(`originals/${uploadId}/${safeFilename(original.name)}`, original, {
          access: "private",
          handleUploadUrl: "/api/admin/uploads/blob",
          clientPayload: JSON.stringify({ uploadId, kind: "original" }),
          contentType: original.type,
          multipart: original.size > 5 * 1024 * 1024,
        });
        const completeResponse = await fetch("/api/admin/uploads/complete", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            uploadId,
            albumId,
            title: derivedTitle,
            category,
            price: Number(price),
            originalName: original.name,
            contentType: original.type,
            previewKey: previewBlob.pathname,
            originalKey: originalBlob.pathname,
          }),
        });
        if (!completeResponse.ok) {
          throw new Error(await apiError(completeResponse, `No pudimos publicar ${original.name}.`));
        }
      }

      uploadFormRef.current?.reset();
      setUploadMessage(`${originals.length} ${originals.length === 1 ? "foto publicada" : "fotos publicadas"} correctamente.`);
      await loadPhotos();
    } catch (reason) {
      setUploadMessage(reason instanceof Error ? reason.message : "No pudimos publicar las fotos.");
    } finally {
      setUploading(false);
    }
  }

  async function refreshWatermarks() {
    if (!selectedPhotos.length || watermarking) return;
    setWatermarking(true);
    setWatermarkMessage("");
    try {
      const logoResponse = await fetch("/brand/daniel-fotografia-watermark.png");
      if (!logoResponse.ok) throw new Error("No pudimos cargar el logo oficial.");
      const logoBlob = await logoResponse.blob();
      const logo = new File([logoBlob], "daniel-fotografia-watermark.png", { type: "image/png" });

      let nextPhotoIndex = 0;
      let completedPhotos = 0;
      let firstError: Error | null = null;

      async function processNextPhoto() {
        while (!firstError) {
          const index = nextPhotoIndex;
          nextPhotoIndex += 1;
          if (index >= selectedPhotos.length) return;
          const photo = selectedPhotos[index];

          try {
            const originalResponse = await fetch(`/api/admin/photos/${photo.id}/original`, { cache: "no-store" });
            if (!originalResponse.ok) {
              throw new Error(await apiError(originalResponse, `No pudimos preparar ${photo.title}.`));
            }
            const originalBlob = await originalResponse.blob();
            const original = new File([originalBlob], `${photo.title}.jpg`, {
              type: originalBlob.type || "image/jpeg",
            });
            const preview = await makePreview(original, logo, settings.watermarkText);
            const replacementId = crypto.randomUUID();
            const previewBlob = await upload(`previews/${photo.id}/${replacementId}.jpg`, preview, {
              access: "private",
              handleUploadUrl: "/api/admin/uploads/blob",
              clientPayload: JSON.stringify({ uploadId: photo.id, replacementId, kind: "preview-replacement" }),
              contentType: "image/jpeg",
            });
            const replacementResponse = await fetch(`/api/admin/photos/${photo.id}/preview`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ previewKey: previewBlob.pathname }),
            });
            if (!replacementResponse.ok) {
              throw new Error(await apiError(replacementResponse, `No pudimos actualizar ${photo.title}.`));
            }
            completedPhotos += 1;
            setWatermarkMessage(`Actualizando ${completedPhotos} de ${selectedPhotos.length}…`);
          } catch (reason) {
            firstError = reason instanceof Error ? reason : new Error(`No pudimos actualizar ${photo.title}.`);
          }
        }
      }

      const simultaneousPhotos = Math.min(3, selectedPhotos.length);
      await Promise.all(Array.from({ length: simultaneousPhotos }, () => processNextPhoto()));
      if (firstError) throw firstError;
      setWatermarkMessage(`Marca de agua actualizada en ${selectedPhotos.length} ${selectedPhotos.length === 1 ? "foto" : "fotos"}.`);
    } catch (reason) {
      setWatermarkMessage(reason instanceof Error ? reason.message : "No pudimos actualizar las marcas de agua.");
    } finally {
      setWatermarking(false);
    }
  }

  async function updatePhoto(id: string, changes: { title?: string; category?: string; price?: number; published?: boolean; albumId?: string }) {
    const response = await fetch(`/api/admin/photos/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(changes),
    });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error ?? "No pudimos guardar los cambios.");
    await loadPhotos();
  }

  async function deletePhoto(id: string) {
    const response = await fetch(`/api/admin/photos/${id}`, { method: "DELETE" });
    const data = (await response.json()) as { error?: string };
    if (!response.ok) throw new Error(data.error ?? "No pudimos eliminar la foto.");
    setPhotos((current) => current.filter((photo) => photo.id !== id));
  }

  async function movePhoto(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= selectedPhotos.length) return;
    const previous = photos;
    const reordered = [...selectedPhotos];
    [reordered[index], reordered[target]] = [reordered[target], reordered[index]];
    let selectedIndex = 0;
    setPhotos((current) => current.map((photo) => {
      const belongs = selectedAlbumId === "unassigned" ? !photo.albumId : photo.albumId === selectedAlbumId;
      return belongs ? reordered[selectedIndex++] : photo;
    }));
    const response = await fetch("/api/admin/photo-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: reordered.map((photo) => photo.id) }),
    });
    if (!response.ok) setPhotos(previous);
  }

  async function saveSettings(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSettingsMessage("");
    const data = Object.fromEntries(new FormData(event.currentTarget)) as EditableSiteSettings;
    const response = await fetch("/api/admin/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setSettingsMessage(result.error ?? "No pudimos guardar los cambios.");
      return;
    }
    setSettings(data);
    setSettingsMessage("Cambios guardados. Ya se ven en la página pública.");
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordMessage("");
    const form = new FormData(event.currentTarget);
    const currentPassword = String(form.get("currentPassword") || "");
    const newPassword = String(form.get("newPassword") || "");
    const confirmation = String(form.get("confirmation") || "");
    if (newPassword !== confirmation) {
      setPasswordMessage("Las contraseñas nuevas no coinciden.");
      return;
    }
    const response = await fetch("/api/admin/password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = (await response.json()) as { error?: string };
    setPasswordMessage(response.ok ? "Contraseña actualizada correctamente." : data.error ?? "No pudimos cambiarla.");
    if (response.ok) event.currentTarget.reset();
  }

  async function changeEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailMessage("");
    const form = new FormData(event.currentTarget);
    const newEmail = String(form.get("newEmail") || "").trim().toLowerCase();
    const currentPassword = String(form.get("currentPassword") || "");
    const response = await fetch("/api/admin/email", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ newEmail, currentPassword }),
    });
    const data = (await response.json()) as { email?: string; error?: string };
    if (!response.ok || !data.email) {
      setEmailMessage(data.error ?? "No pudimos cambiar el email.");
      return;
    }
    setAdminEmail(data.email);
    setEmailMessage("Email de acceso actualizado correctamente.");
    const passwordInput = event.currentTarget.elements.namedItem("currentPassword") as HTMLInputElement | null;
    if (passwordInput) passwordInput.value = "";
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    window.location.reload();
  }

  return (
    <div className="mx-auto max-w-[1440px] px-5 py-10 sm:px-8 lg:px-12 lg:py-14">
      <div className="flex flex-col justify-between gap-6 border-b border-white/10 pb-8 sm:flex-row sm:items-end">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.3em] text-[#c6a56d]">Autogestión</p>
          <h1 className="mt-3 font-serif text-4xl sm:text-5xl">Panel de Daniel</h1>
          <p className="mt-3 text-sm text-white/45">Administrá fotos, contenido y seguridad desde un solo lugar.</p>
        </div>
        <Button onClick={logout} variant="ghost" className="self-start text-white/50 hover:bg-white/5 hover:text-white sm:self-auto">
          <LogOut /> Cerrar sesión
        </Button>
      </div>

      <Tabs defaultValue="photos" className="mt-8">
        <TabsList variant="line" className="h-12 w-full justify-start gap-5 border-b border-white/10">
          <TabsTrigger value="photos" className="flex-none px-1"><ImagePlus /> Fotos</TabsTrigger>
          <TabsTrigger value="appearance" className="flex-none px-1"><Palette /> Contenido</TabsTrigger>
          <TabsTrigger value="security" className="flex-none px-1"><KeyRound /> Seguridad</TabsTrigger>
        </TabsList>

        <TabsContent value="photos" className="space-y-10 pt-8">
          <section className="border border-[#c6a56d]/40 bg-[#c6a56d]/[0.07] p-6 sm:p-8">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-2xl">
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#c6a56d]">Herramienta de marca de agua</p>
                <h2 className="mt-3 font-serif text-3xl">Actualizar fotos ya publicadas</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">
                  Elegí una carpeta y aplicá una sola marca central, amplia y profesional. Las fotos originales y las compras no se modifican.
                </p>
                {watermarkMessage ? <p className="mt-3 flex items-start gap-2 text-sm text-[#e2c897]"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {watermarkMessage}</p> : null}
              </div>
              <div className="grid w-full gap-3 sm:grid-cols-[minmax(220px,1fr)_auto] lg:w-auto">
                <div className="space-y-2">
                  <Label htmlFor="watermarkAlbumId" className="text-xs text-white/70">Carpeta que querés actualizar</Label>
                  <NativeSelect
                    id="watermarkAlbumId"
                    value={selectedAlbumId}
                    onChange={(event) => {
                      setSelectedAlbumId(event.target.value);
                      setWatermarkMessage("");
                    }}
                    className="h-12 min-w-64 border-[#c6a56d]/35 bg-[#15130f]"
                  >
                    {albums.map((album) => <NativeSelectOption key={album.id} value={album.id}>{album.title}</NativeSelectOption>)}
                    {photos.some((photo) => !photo.albumId) ? <NativeSelectOption value="unassigned">Fotos sin carpeta</NativeSelectOption> : null}
                  </NativeSelect>
                </div>
                <div className="flex items-end">
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button type="button" disabled={!selectedPhotos.length || watermarking} className="h-12 w-full bg-[#c6a56d] px-6 font-semibold text-black hover:bg-[#d5bb90] sm:w-auto">
                        {watermarking ? <><LoaderCircle className="animate-spin" /> Actualizando</> : <><ImagePlus /> Actualizar marca de agua</>}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="border-white/10 bg-[#111] text-white">
                      <AlertDialogHeader>
                        <AlertDialogTitle>¿Actualizar {selectedPhotos.length} {selectedPhotos.length === 1 ? "foto" : "fotos"}?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Se regenerarán las vistas protegidas de esta carpeta con una marca central, sin repeticiones ni superposiciones. Las fotos originales y las compras no cambiarán. El proceso puede tardar unos minutos.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={refreshWatermarks}>Sí, actualizar marcas</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            </div>
            {!selectedPhotos.length ? <p className="mt-4 text-xs text-white/40">La carpeta seleccionada todavía no tiene fotos para actualizar.</p> : null}
          </section>

          <section className="border border-white/10 bg-[#111] p-6 sm:p-8">
            <div className="grid gap-8 xl:grid-cols-[0.7fr_1.3fr]">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#c6a56d]">Paso 1</p>
                <h2 className="mt-3 font-serif text-3xl">Crear carpeta de evento</h2>
                <p className="mt-2 text-sm leading-6 text-white/45">Cada carpeta aparece como una sola portada en la página principal. Las fotos se ven recién cuando el cliente entra.</p>
                <form onSubmit={createAlbum} className="mt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="albumTitle" className="text-xs text-white/70">Nombre que verá el cliente</Label>
                    <Input id="albumTitle" name="albumTitle" required minLength={3} maxLength={120} placeholder="Argentino - Huracán · Fútbol masculino" className="h-11 border-white/15 bg-white/5" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="albumDescription" className="text-xs text-white/70">Descripción (opcional)</Label>
                    <Input id="albumDescription" name="albumDescription" maxLength={500} placeholder="Fecha, categoría o lugar del encuentro" className="h-11 border-white/15 bg-white/5" />
                  </div>
                  {albumMessage ? <p className="text-xs leading-5 text-[#d5bb90]">{albumMessage}</p> : null}
                  <Button type="submit" className="h-11 bg-[#c6a56d] text-black hover:bg-[#d5bb90]"><FolderPlus /> Crear carpeta</Button>
                </form>
              </div>

              <div className="xl:border-l xl:border-white/10 xl:pl-8">
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.25em] text-[#c6a56d]">{albums.length} {albums.length === 1 ? "carpeta" : "carpetas"}</p>
                    <h3 className="mt-2 font-serif text-2xl">Eventos publicados</h3>
                  </div>
                  {photos.some((photo) => !photo.albumId) ? (
                    <Button type="button" size="sm" variant={selectedAlbumId === "unassigned" ? "default" : "outline"} onClick={() => setSelectedAlbumId("unassigned")}>Sin carpeta</Button>
                  ) : null}
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {albums.length ? albums.map((album, index) => (
                    <AlbumEditor
                      key={album.id}
                      album={album}
                      count={photos.filter((photo) => photo.albumId === album.id).length}
                      selected={selectedAlbumId === album.id}
                      first={index === 0}
                      last={index === albums.length - 1}
                      onSelect={() => setSelectedAlbumId(album.id)}
                      onMove={(direction) => moveAlbum(index, direction)}
                      onUpdate={(changes) => updateAlbum(album.id, changes)}
                      onDelete={() => deleteAlbum(album.id)}
                    />
                  )) : (
                    <div className="col-span-full grid min-h-44 place-items-center border border-dashed border-white/15 p-6 text-center">
                      <div><FolderOpen className="mx-auto size-7 text-[#c6a56d]" /><p className="mt-3 text-sm text-white/45">Creá la primera carpeta para comenzar.</p></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          <div className="grid gap-10 lg:grid-cols-[0.65fr_1.35fr]">
            <section>
              <p className="text-[10px] font-semibold uppercase tracking-[0.28em] text-[#c6a56d]">Paso 2</p>
              <h2 className="font-serif text-3xl">Publicar imágenes</h2>
              <p className="mt-2 text-sm leading-6 text-white/45">
                Podés seleccionar muchas fotos juntas. No hay un límite fijo de publicaciones.
              </p>
              <p className="mt-2 text-xs leading-5 text-[#d5bb90]/70">
                El original queda privado y la galería muestra automáticamente una copia protegida con marca de agua.
              </p>
              <form ref={uploadFormRef} onSubmit={uploadPhotos} className="mt-6 space-y-5 border border-white/10 bg-[#111] p-6">
                <div className="space-y-2">
                  <Label htmlFor="albumId" className="text-xs text-white/70">Carpeta del evento</Label>
                  <NativeSelect id="albumId" name="albumId" required value={selectedAlbumId === "unassigned" ? "" : selectedAlbumId} onChange={(event) => setSelectedAlbumId(event.target.value)} className="h-11 border-white/15 bg-[#191919]">
                    <NativeSelectOption value="" disabled>Elegí una carpeta</NativeSelectOption>
                    {albums.map((album) => <NativeSelectOption key={album.id} value={album.id}>{album.title}</NativeSelectOption>)}
                  </NativeSelect>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="originals" className="text-xs text-white/70">Fotos originales sin marca de agua</Label>
                  <Input id="originals" name="originals" type="file" multiple accept="image/jpeg,image/png,image/webp" required className="h-12 border-dashed border-white/20 bg-white/5 py-2" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="title" className="text-xs text-white/70">Título o nombre del evento (opcional)</Label>
                  <Input id="title" name="title" placeholder="Si lo dejás vacío se usa el nombre del archivo" className="h-11 border-white/15 bg-white/5" />
                </div>
                <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="category" className="text-xs text-white/70">Categoría</Label>
                    <Input id="category" name="category" required defaultValue="Fotografía deportiva" className="h-11 border-white/15 bg-white/5" />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="price" className="text-xs text-white/70">Precio en pesos</Label>
                    <Input id="price" name="price" type="number" min="1" step="1" required placeholder="8500" className="h-11 border-white/15 bg-white/5" />
                  </div>
                </div>
                <p className="rounded-md border border-[#c6a56d]/20 bg-[#c6a56d]/5 p-3 text-[11px] leading-5 text-[#d5bb90]/80">La marca de agua oficial de Daniel Justiniano se aplica automáticamente a todas las vistas previas.</p>
                {uploadMessage ? <p className="flex items-start gap-2 text-xs leading-5 text-[#d5bb90]"><CheckCircle2 className="mt-0.5 size-4 shrink-0" /> {uploadMessage}</p> : null}
                <Button type="submit" disabled={uploading} className="h-12 w-full bg-[#c6a56d] text-black hover:bg-[#d5bb90]">
                  {uploading ? <><LoaderCircle className="animate-spin" /> Publicando imágenes</> : <><Upload /> Publicar selección</>}
                </Button>
              </form>
            </section>

            <section className="lg:border-l lg:border-white/10 lg:pl-10">
              <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[10px] uppercase tracking-[0.25em] text-[#c6a56d]">{selectedPhotos.length} en esta carpeta</p>
                  <h2 className="mt-2 font-serif text-3xl">{selectedAlbum?.title ?? "Fotos sin carpeta"}</h2>
                </div>
                <div className="grid grid-cols-3 divide-x divide-white/10 border border-white/10 bg-white/[0.02] text-center">
                  <AdminStat value={selectedPhotos.length} label="Total" />
                  <AdminStat value={visiblePhotos} label="Visibles" />
                  <AdminStat value={hiddenPhotos} label="Ocultas" />
                </div>
              </div>
              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                {selectedPhotos.length ? selectedPhotos.map((photo, index) => (
                  <PhotoEditor
                    key={photo.id}
                    photo={photo}
                    first={index === 0}
                    last={index === selectedPhotos.length - 1}
                    onMove={(direction) => movePhoto(index, direction)}
                    onUpdate={(changes) => updatePhoto(photo.id, changes)}
                    onDelete={() => deletePhoto(photo.id)}
                    albums={albums}
                  />
                )) : (
                  <div className="col-span-full grid min-h-64 place-items-center border border-dashed border-white/15 p-8 text-center">
                    <div>
                      <ImagePlus className="mx-auto size-7 text-[#c6a56d]" />
                      <p className="mt-4 font-serif text-2xl">Esta carpeta todavía no tiene fotos</p>
                      <p className="mt-2 text-sm text-white/40">Subí una tanda y aparecerá dentro de este evento.</p>
                    </div>
                  </div>
                )}
              </div>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="appearance" className="pt-8">
          <form onSubmit={saveSettings} className="max-w-3xl space-y-6 border border-white/10 bg-[#111] p-6 sm:p-8">
            <div>
              <h2 className="font-serif text-3xl">Textos de la página</h2>
              <p className="mt-2 text-sm text-white/45">Daniel puede cambiar estos textos sin tocar el diseño ni el código.</p>
            </div>
            <div className="grid gap-5 sm:grid-cols-2">
              <SettingField name="heroKicker" label="Texto sobre el logo" value={settings.heroKicker} />
              <SettingField name="galleryEyebrow" label="Texto sobre los eventos" value={settings.galleryEyebrow} />
              <SettingField name="galleryTitle" label="Título de los eventos" value={settings.galleryTitle} />
              <SettingField name="watermarkText" label="Texto alternativo de marca de agua" value={settings.watermarkText} />
            </div>
            <SettingField name="heroDescription" label="Descripción principal" value={settings.heroDescription} />
            <SettingField name="footerText" label="Texto del pie de página" value={settings.footerText} />
            {settingsMessage ? <p className="text-xs text-[#d5bb90]">{settingsMessage}</p> : null}
            <Button type="submit" className="h-11 bg-[#c6a56d] text-black hover:bg-[#d5bb90]"><Save /> Guardar contenido</Button>
          </form>
        </TabsContent>

        <TabsContent value="security" className="pt-8">
          <div className="grid max-w-5xl gap-6 lg:grid-cols-2">
            <form onSubmit={changeEmail} className="space-y-5 border border-white/10 bg-[#111] p-6 sm:p-8">
              <div>
                <h2 className="font-serif text-3xl">Cambiar email</h2>
                <p className="mt-2 text-sm leading-6 text-white/45">Correo actual: <span className="text-white/75">{adminEmail}</span></p>
              </div>
              <SettingField key={adminEmail} name="newEmail" type="email" label="Nuevo email de acceso" value={adminEmail} />
              <SettingField name="currentPassword" type="password" label="Contraseña actual" value="" />
              {emailMessage ? <p className="text-xs text-[#d5bb90]">{emailMessage}</p> : null}
              <Button type="submit" className="h-11 bg-[#c6a56d] text-black hover:bg-[#d5bb90]"><Save /> Actualizar email</Button>
            </form>

            <form onSubmit={changePassword} className="space-y-5 border border-white/10 bg-[#111] p-6 sm:p-8">
              <div>
                <h2 className="font-serif text-3xl">Cambiar contraseña</h2>
                <p className="mt-2 text-sm leading-6 text-white/45">La nueva clave reemplaza a la anterior inmediatamente.</p>
              </div>
              <SettingField name="currentPassword" type="password" label="Contraseña actual" value="" />
              <SettingField name="newPassword" type="password" label="Contraseña nueva" value="" />
              <SettingField name="confirmation" type="password" label="Repetir contraseña nueva" value="" />
              {passwordMessage ? <p className="text-xs text-[#d5bb90]">{passwordMessage}</p> : null}
              <Button type="submit" className="h-11 bg-[#c6a56d] text-black hover:bg-[#d5bb90]"><KeyRound /> Actualizar contraseña</Button>
            </form>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function SettingField({
  name,
  label,
  value,
  type = "text",
}: {
  name: string;
  label: string;
  value: string;
  type?: string;
}) {
  return (
    <div className="space-y-2">
      <Label htmlFor={name} className="text-xs text-white/70">{label}</Label>
      <Input id={name} name={name} type={type} defaultValue={value} required className="h-11 border-white/15 bg-white/5" />
    </div>
  );
}

function AlbumEditor({
  album,
  count,
  selected,
  first,
  last,
  onSelect,
  onMove,
  onUpdate,
  onDelete,
}: {
  album: AdminAlbum;
  count: number;
  selected: boolean;
  first: boolean;
  last: boolean;
  onSelect: () => void;
  onMove: (direction: -1 | 1) => void;
  onUpdate: (changes: { title?: string; description?: string; published?: boolean }) => Promise<void>;
  onDelete: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await onUpdate({ title: String(form.get("title") || ""), description: String(form.get("description") || "") });
      setMessage("Carpeta guardada");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No pudimos guardarla.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished() {
    setSaving(true);
    setMessage("");
    try {
      await onUpdate({ published: !album.published });
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No pudimos cambiar la publicación.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setMessage("");
    try {
      await onDelete();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No pudimos eliminarla.");
      setSaving(false);
    }
  }

  return (
    <article className={`border p-4 transition ${selected ? "border-[#c6a56d]/60 bg-[#c6a56d]/5" : "border-white/10 bg-black/15"}`}>
      <button type="button" onClick={onSelect} className="mb-4 flex w-full items-center justify-between gap-3 text-left">
        <span className="flex min-w-0 items-center gap-3"><FolderOpen className="size-5 shrink-0 text-[#c6a56d]" /><span className="truncate text-sm font-semibold">{album.title}</span></span>
        <span className="shrink-0 text-[10px] text-white/35">{count} {count === 1 ? "foto" : "fotos"}</span>
      </button>
      <form onSubmit={save} className="space-y-3">
        <Input name="title" defaultValue={album.title} aria-label="Nombre de la carpeta" className="h-9 border-white/15 bg-white/5" />
        <Input name="description" defaultValue={album.description} aria-label="Descripción de la carpeta" placeholder="Descripción opcional" className="h-9 border-white/15 bg-white/5" />
        {message ? <p className="text-[11px] leading-4 text-[#d5bb90]">{message}</p> : null}
        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
          <Button type="submit" size="icon-sm" disabled={saving} aria-label="Guardar carpeta" className="bg-[#c6a56d] text-black hover:bg-[#d5bb90]"><Save /></Button>
          <Button type="button" size="icon-sm" variant="outline" disabled={first || saving} onClick={() => onMove(-1)} aria-label="Mover carpeta arriba"><ArrowUp /></Button>
          <Button type="button" size="icon-sm" variant="outline" disabled={last || saving} onClick={() => onMove(1)} aria-label="Mover carpeta abajo"><ArrowDown /></Button>
          <Button type="button" size="icon-sm" variant="outline" disabled={saving} onClick={togglePublished} aria-label={album.published ? "Ocultar carpeta" : "Publicar carpeta"}>{album.published ? <EyeOff /> : <Eye />}</Button>
          <AlertDialog>
            <AlertDialogTrigger asChild><Button type="button" size="icon-sm" variant="destructive" disabled={saving} aria-label="Eliminar carpeta"><Trash2 /></Button></AlertDialogTrigger>
            <AlertDialogContent className="border-white/10 bg-[#111] text-white">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar “{album.title}”?</AlertDialogTitle>
                <AlertDialogDescription>Solo se puede eliminar una carpeta vacía. Las fotos y compras existentes quedan protegidas.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={remove}>Eliminar carpeta</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </form>
    </article>
  );
}

function AdminStat({ value, label }: { value: number; label: string }) {
  return (
    <div className="min-w-20 px-3 py-2.5">
      <p className="font-serif text-xl text-white">{value}</p>
      <p className="text-[9px] uppercase tracking-[0.16em] text-white/35">{label}</p>
    </div>
  );
}

function PhotoEditor({
  photo,
  first,
  last,
  onMove,
  onUpdate,
  onDelete,
  albums,
}: {
  photo: AdminPhoto;
  first: boolean;
  last: boolean;
  onMove: (direction: -1 | 1) => void;
  onUpdate: (changes: { title?: string; category?: string; price?: number; published?: boolean; albumId?: string }) => Promise<void>;
  onDelete: () => Promise<void>;
  albums: AdminAlbum[];
}) {
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      await onUpdate({
        title: String(form.get("title") || ""),
        category: String(form.get("category") || ""),
        price: Number(form.get("price")),
        albumId: String(form.get("albumId") || ""),
      });
      setMessage("Guardado");
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No pudimos guardar.");
    } finally {
      setSaving(false);
    }
  }

  async function togglePublished() {
    setSaving(true);
    setMessage("");
    try {
      await onUpdate({ published: !photo.published });
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No pudimos cambiar la publicación.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    setSaving(true);
    setMessage("");
    try {
      await onDelete();
    } catch (reason) {
      setMessage(reason instanceof Error ? reason.message : "No pudimos eliminarla.");
      setSaving(false);
    }
  }

  return (
    <article className={`overflow-hidden border bg-[#111] ${photo.published ? "border-white/10" : "border-amber-300/20 opacity-75"}`}>
      <div className="relative aspect-[4/3] bg-black">
        <img src={`/api/photos/${photo.id}/preview?wv=7`} alt={photo.title} loading="lazy" className="h-full w-full object-cover" />
        <span className={`absolute left-3 top-3 rounded-full px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.15em] ${photo.published ? "bg-emerald-400/90 text-black" : "bg-amber-300 text-black"}`}>
          {photo.published ? "Visible" : "Oculta"}
        </span>
      </div>
      <form onSubmit={save} className="space-y-3 p-4">
        <Input name="title" defaultValue={photo.title} aria-label="Título" className="h-9 border-white/15 bg-white/5" />
        <div className="grid grid-cols-2 gap-3">
          <Input name="category" defaultValue={photo.category} aria-label="Categoría" className="h-9 border-white/15 bg-white/5" />
          <Input name="price" type="number" min="1" step="1" defaultValue={photo.priceCents / 100} aria-label="Precio" className="h-9 border-white/15 bg-white/5" />
        </div>
        <NativeSelect name="albumId" defaultValue={photo.albumId ?? ""} aria-label="Carpeta" className="h-9 border-white/15 bg-[#191919]">
          <NativeSelectOption value="" disabled>Elegí una carpeta</NativeSelectOption>
          {albums.map((album) => <NativeSelectOption key={album.id} value={album.id}>{album.title}</NativeSelectOption>)}
        </NativeSelect>
        {message ? <p className="text-[11px] leading-4 text-[#d5bb90]">{message}</p> : null}
        <div className="flex flex-wrap gap-2 border-t border-white/10 pt-3">
          <Button type="submit" size="sm" disabled={saving} className="bg-[#c6a56d] text-black hover:bg-[#d5bb90]"><Save /> Guardar</Button>
          <Button type="button" size="icon-sm" variant="outline" disabled={first || saving} onClick={() => onMove(-1)} aria-label="Mover arriba"><ArrowUp /></Button>
          <Button type="button" size="icon-sm" variant="outline" disabled={last || saving} onClick={() => onMove(1)} aria-label="Mover abajo"><ArrowDown /></Button>
          <Button type="button" size="sm" variant="outline" disabled={saving} onClick={togglePublished} aria-label={photo.published ? "Ocultar" : "Publicar"}>
            {photo.published ? <><EyeOff /> Ocultar</> : <><Eye /> Publicar</>}
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button type="button" size="sm" variant="destructive" disabled={saving} aria-label="Eliminar foto"><Trash2 /> Eliminar</Button>
            </AlertDialogTrigger>
            <AlertDialogContent className="border-white/10 bg-[#111] text-white">
              <AlertDialogHeader>
                <AlertDialogTitle>¿Eliminar “{photo.title}”?</AlertDialogTitle>
                <AlertDialogDescription>
                  Se borrarán definitivamente la vista protegida, el archivo original y todas las compras asociadas. Quienes la hayan comprado perderán el acceso a la descarga. Esta acción no se puede deshacer.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={remove}>Eliminar definitivamente</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </form>
    </article>
  );
}
