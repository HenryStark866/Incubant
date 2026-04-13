import { type Response } from 'express';
import { db } from '../firebase';

export const processMachineReport = async (req: any, res: Response) => {
  try {
    const { machineId, reportData } = req.body;
    const userId = req.user?.id;
    
    // In Firebase we do directly push instead of insert.
    const newReportRef = db.ref('reports').push();
    await newReportRef.set({
      machine_id: machineId,
      user_id: userId,
      data: reportData,
      status: 'NORMAL',
      timestamp: new Date().toISOString()
    });

    res.status(201).json({ success: true, reportId: newReportRef.key });
  } catch (error) {
    res.status(500).json({ error: 'Fallo al procesar el reporte en Firebase.' });
  }
};

export const requestClosingReport = async (req: any, res: Response) => {
   res.status(200).json({ message: 'Sin registros hoy (Mock).' });
};

export const getHistory = async (_req: any, res: Response) => {
   res.status(200).json({ logs: [], incidents: [], reports: [] });
};
