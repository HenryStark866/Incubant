import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Only create client if credentials exist to prevent crashes
export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

export async function uploadEvidenceImage(base64Image: string, machineId: string): Promise<string | null> {
  if (!supabase) {
    console.warn('Supabase credentials not found. Returning local base64 image.');
    return base64Image;
  }

  try {
    // Convert base64 to Blob
    const base64Data = base64Image.replace(/^data:image\/\w+;base64,/, '');
    const byteCharacters = atob(base64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 512) {
      const slice = byteCharacters.slice(offset, offset + 512);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    const blob = new Blob(byteArrays, { type: 'image/jpeg' });
    const fileName = `${machineId}_${Date.now()}.jpg`;

    const { data, error } = await supabase.storage
      .from('evidencias')
      .upload(fileName, blob, {
        contentType: 'image/jpeg',
        upsert: false
      });

    if (error) {
      console.error('Error uploading image to Supabase:', error);
      return base64Image; // Fallback to base64 if upload fails
    }

    const { data: publicUrlData } = supabase.storage
      .from('evidencias')
      .getPublicUrl(fileName);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Exception uploading image:', error);
    return base64Image; // Fallback
  }
}

export async function uploadEvidencePDF(pdfBlob: Blob, operario: string): Promise<string | null> {
  if (!supabase) return null;

  try {
    const fileName = `Reporte_${operario.replace(/\s+/g, '_')}_${Date.now()}.pdf`;

    const { data, error } = await supabase.storage
      .from('evidencias')
      .upload(`reportes/${fileName}`, pdfBlob, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (error) {
      console.error('Error uploading PDF to Supabase:', error);
      return null;
    }

    const { data: publicUrlData } = supabase.storage
      .from('evidencias')
      .getPublicUrl(`reportes/${fileName}`);

    return publicUrlData.publicUrl;
  } catch (error) {
    console.error('Exception uploading PDF:', error);
    return null;
  }
}

export async function listEvidences(folder: string = '') {
  if (!supabase) return [];
  
  try {
    const { data, error } = await supabase.storage
      .from('evidencias')
      .list(folder, {
        limit: 100,
        offset: 0,
        sortBy: { column: 'created_at', order: 'desc' },
      });

    if (error) {
      console.error('Error listing evidences:', error);
      return [];
    }

    return data.map(file => {
      const { data: publicUrlData } = supabase.storage
        .from('evidencias')
        .getPublicUrl(`${folder ? folder + '/' : ''}${file.name}`);
      
      return {
        ...file,
        publicUrl: publicUrlData.publicUrl
      };
    });
  } catch (error) {
    console.error('Error fetching evidences list:', error);
    return [];
  }
}
