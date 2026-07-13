'use client';

import type { ChangeEvent } from 'react';
import { useCallback, useEffect, useState } from 'react';
import { ImageCropEditor } from '@/app/forms/[id]/builder/image-crop-editor';
import { useToast } from '@/components/toast';
import { getErrorMessage } from '@/lib/error-message';
import { isCroppableImage } from '@/lib/forms/crop-image';
import { getFieldImageSrc } from '@/lib/forms/field-image';

interface FieldImageUploadProps {
  formId: string;
  fieldId: string;
  imageStorageKey?: string;
  canEdit: boolean;
  onUploaded: (storageKey: string) => void;
  onRemove: () => void;
}

interface CropSession {
  imageSrc: string;
  fileName: string;
  /** Object URL created for a newly picked file — revoked when the session ends. */
  revokeOnClose: boolean;
}

export function FieldImageUpload({
  formId,
  fieldId,
  imageStorageKey,
  canEdit,
  onUploaded,
  onRemove,
}: FieldImageUploadProps) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null);
  const [cropSession, setCropSession] = useState<CropSession | null>(null);

  useEffect(() => {
    return () => {
      if (localPreviewUrl) URL.revokeObjectURL(localPreviewUrl);
    };
  }, [localPreviewUrl]);

  useEffect(() => {
    if (imageStorageKey && localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
  }, [imageStorageKey, localPreviewUrl]);

  const imageSrc =
    localPreviewUrl ?? (imageStorageKey ? getFieldImageSrc({ formId, fieldId }) : null);

  const closeCropSession = useCallback(() => {
    setCropSession((prev) => {
      if (prev?.revokeOnClose) URL.revokeObjectURL(prev.imageSrc);
      return null;
    });
  }, []);

  const uploadImage = useCallback(
    async (file: File) => {
      setUploading(true);
      try {
        const presignRes = await fetch(`/api/forms/${formId}/fields/${fieldId}/image`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          }),
        });
        const presignData: { uploadUrl?: string; storageKey?: string; error?: string } =
          await presignRes.json();
        if (!presignRes.ok || !presignData.uploadUrl || !presignData.storageKey) {
          throw new Error(presignData.error ?? 'Could not start image upload.');
        }

        const putRes = await fetch(presignData.uploadUrl, {
          method: 'PUT',
          headers: { 'Content-Type': file.type || 'application/octet-stream' },
          body: file,
        });
        if (!putRes.ok) {
          throw new Error('Uploading the image failed.');
        }

        const confirmRes = await fetch(`/api/forms/${formId}/fields/${fieldId}/image`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            storageKey: presignData.storageKey,
            filename: file.name,
            mimeType: file.type || 'application/octet-stream',
            sizeBytes: file.size,
          }),
        });
        const confirmData: { storageKey?: string; error?: string } = await confirmRes.json();
        if (!confirmRes.ok || !confirmData.storageKey) {
          throw new Error(confirmData.error ?? 'Could not confirm image upload.');
        }

        onUploaded(confirmData.storageKey);
        setLocalPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(file);
        });
        closeCropSession();
        toast.success('Image uploaded');
      } catch (err) {
        toast.error(getErrorMessage(err, 'Image upload failed.'));
        throw err;
      } finally {
        setUploading(false);
      }
    },
    [closeCropSession, fieldId, formId, onUploaded, toast],
  );

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !canEdit) return;

    // SVG can't be cropped via canvas — upload as-is.
    if (!isCroppableImage(file.type)) {
      void uploadImage(file).catch(() => {
        // Toast already shown in uploadImage.
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setCropSession({
      imageSrc: objectUrl,
      fileName: file.name,
      revokeOnClose: true,
    });
  }

  async function handleEditExisting() {
    if (!canEdit || !imageSrc) return;
    try {
      // Fetch into a blob URL so the crop canvas stays same-origin (avoids CORS taint
      // when the image API redirects to S3/Supabase).
      const res = await fetch(imageSrc);
      if (!res.ok) throw new Error('Could not load the image.');
      const blob = await res.blob();
      if (blob.type && !isCroppableImage(blob.type)) {
        throw new Error('Cropping isn’t available for this format. Replace with a PNG or JPG.');
      }
      const objectUrl = URL.createObjectURL(blob);
      setCropSession({
        imageSrc: objectUrl,
        fileName: 'image.png',
        revokeOnClose: true,
      });
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not load the image for editing.'));
    }
  }

  function handleRemove() {
    if (!canEdit) return;
    if (localPreviewUrl) {
      URL.revokeObjectURL(localPreviewUrl);
      setLocalPreviewUrl(null);
    }
    onRemove();
  }

  return (
    <div className="field-image-upload">
      {imageSrc ? (
        <div className="field-image-upload-preview">
          {/* biome-ignore lint/performance/noImgElement: local object URL / API redirect preview; next/image is a poor fit here */}
          <img src={imageSrc} alt="" className="field-image-upload-image" />
        </div>
      ) : (
        <div className="field-image-upload-placeholder">No image uploaded</div>
      )}

      {canEdit ? (
        <div className="field-image-upload-actions">
          <label className="button button--ghost button--small field-image-upload-label">
            {uploading ? 'Uploading…' : imageSrc ? 'Replace image' : 'Upload image'}
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
              className="field-image-upload-input"
              disabled={uploading}
              onChange={handleFileChange}
            />
          </label>
          {imageSrc ? (
            <>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() => void handleEditExisting()}
                disabled={uploading}
              >
                Edit & crop
              </button>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={handleRemove}
                disabled={uploading}
              >
                Remove
              </button>
            </>
          ) : null}
        </div>
      ) : null}

      <p className="field-image-upload-hint">
        PNG, JPG, WebP, or GIF — crop and rotate before upload. SVG uploads as-is. Max 5 MB.
      </p>

      {cropSession ? (
        <ImageCropEditor
          key={cropSession.imageSrc}
          open
          imageSrc={cropSession.imageSrc}
          fileName={cropSession.fileName}
          busy={uploading}
          onCancel={closeCropSession}
          onApply={uploadImage}
        />
      ) : null}
    </div>
  );
}
