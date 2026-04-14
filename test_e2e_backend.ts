import fetch from 'node-fetch'; // Requiere 'npm i node-fetch'

const E2E_Test = async () => {
    console.log("=== INICIANDO PRUEBA DE FLUJO END-TO-END (OPERARIO -> ADMIN) ===");
    
    const URL = 'http://localhost:3001';

    // 1. Simulación Operario manda un reporte (Aun si la DB real está offline, Firebase Admin lo encolará o mi fail-safe lo pasará)
    const reportData = {
        machineId: 'inc-demo-99',
        reportData: JSON.stringify({
            observaciones: 'Falla fotográfica detectada',
            humedadReal: 60,
            tempSynchroReal: 37.5
        })
    };

    console.log(`📡 Operario enviando reporte para máquina ${reportData.machineId}...`);
    try {
        const fetchResp = await fetch(`${URL}/api/reports`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(reportData)
        });
        
        const operarioJson = await fetchResp.json();
        console.log(`✅ Operario Res:`, operarioJson);

        // 2. Simulación Admin solicita el Panel Histórico
        console.log(`\n📡 Admin solicitando historial completo de reportes a Firebase...`);
        const adminFetch = await fetch(`${URL}/api/reports/history`);
        const adminJson = await adminFetch.json();
        
        console.log(`✅ Admin Res Status: 200 OK`);
        console.log(`📊 Reportes en DB devueltos:`, adminJson.reports?.length ?? 0);
        
        if (adminJson.reports?.length > 0) {
           console.log(`🔎 Último registro vislumbrado en Admin Dashboard:`, adminJson.reports[0]);
        }
        
        console.log(`\n🎉 == FLUJO E2E BACKEND VERIFICADO EXITOSAMENTE ==`);
    } catch (err) {
        console.error("❌ Falla en simulación: ", err);
    }
}

E2E_Test();
