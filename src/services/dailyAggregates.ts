
export type DailyRow = {
    Date: string;                     // e.g. 2025-01-04
    Toxicity: number;                 // 0~1
    "Prompt Injection": number;       // 0~1
    "Answer Correctness": number;     // 0~1
    "Answer Relevancy": number;       // 0~1
    Length: number;                   // 0~1
    Tone: number;                     // 0~1
    isSimulated?: boolean;            // 시뮬레이션 데이터 여부
  };
  
  const SHEET_ID = "1X5lAcD0uJVtmbEdPjnP6XlesS3pzsmd_";
  const GID = "608001025";
  
  const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=${GID}`;
  
  export type EstimationMode = 'simple' | 'improved' | 'realistic';

  export async function fetchDailyAggregatesWithMode(mode: EstimationMode = 'simple'): Promise<DailyRow[]> {
    try {
      console.log('🔄 Fetching from Google Sheets:', CSV_URL);
      const res = await fetch(CSV_URL, { 
        cache: "no-store",
        mode: 'cors'
      });
      
      console.log('📊 Response status:', res.status);
      
      if (!res.ok) throw new Error(`Sheets CSV fetch failed: ${res.status}`);
      const csv = await res.text();
  
      console.log('📄 CSV data received:', csv);
  
      const lines = csv.split('\n').filter(line => line.trim());
      if (lines.length === 0) {
        console.log('⚠️ No data in CSV, using dummy data');
        return generateDummyRadarData();
      }
      
      const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
      console.log('📋 Headers found:', headers);
      
      const realRows: DailyRow[] = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
        if (values.length >= headers.length && values[0]) {
          const row: any = {};
          headers.forEach((header, index) => {
            row[header] = values[index] || '';
          });
  
          const normalizedRow: DailyRow = {
            Date: String(row["Date"] || row["date"] || "").slice(0, 10),
            Toxicity: Number(row["Toxicity"] || 0),
            "Prompt Injection": Number(row["Prompt Injection"] || row["PromptInjection"] || 0),
            "Answer Correctness": Number(row["Answer Correctness"] || row["Correctness"] || 0),
            "Answer Relevancy": Number(row["Answer Relevancy"] || row["Relevancy"] || 0),
            Length: Number(row["Length"] || 0),
            Tone: Number(row["Tone"] || 0),
            isSimulated: false
          };
  
          if (normalizedRow.Date && normalizedRow.Date !== "0000-00-00") {
            realRows.push(normalizedRow);
          }
        }
      }
  
      const sortedRealRows = realRows.sort((a, b) => a.Date.localeCompare(b.Date));
      
      if (sortedRealRows.length === 0) {
        console.log('⚠️ No valid rows found, using dummy data');
        return generateDummyRadarData();
      }
      
      console.log('✅ Successfully loaded', sortedRealRows.length, 'real rows from Google Sheets');
      
      if (sortedRealRows.length < 30) {
        console.log(`📅 Adding estimated data with ${mode} mode`);
        const allRows = generateExtendedDataWithMode(sortedRealRows, mode);
        return allRows;
      }
      
      return sortedRealRows;
  
    } catch (error) {
      console.error('❌ Failed to fetch Google Sheets data:', error);
      console.log('🔄 Using dummy data instead');
      return generateDummyRadarData();
    }
  }
  
  // 실제 데이터를 기반으로 시뮬레이션 데이터 생성
  function generateExtendedData(realRows: DailyRow[]): DailyRow[] {
    const allRows: DailyRow[] = [];
    const today = new Date();
    
    // 최근 30일 날짜 생성
    for (let i = 29; i >= 0; i--) {
      const date = new Date(today.getTime() - (i * 24 * 60 * 60 * 1000));
      const dateStr = date.toISOString().split('T')[0];
      
      // 해당 날짜에 실제 데이터가 있는지 확인
      const realRow = realRows.find(row => row.Date === dateStr);
      
      if (realRow) {
        // 실제 데이터가 있으면 그대로 사용
        allRows.push(realRow);
      } else {
        // 실제 데이터가 없으면 시뮬레이션 데이터 생성
        const baseRow = realRows[realRows.length - 1] || getDefaultBaseRow();
        const variation = (Math.random() - 0.5) * 0.1; // ±5% 변형
        
        allRows.push({
          Date: dateStr,
          Toxicity: Math.max(0, Math.min(1, baseRow.Toxicity + variation)),
          "Prompt Injection": Math.max(0, Math.min(1, baseRow["Prompt Injection"] + variation)),
          "Answer Correctness": Math.max(0, Math.min(1, baseRow["Answer Correctness"] + variation)),
          "Answer Relevancy": Math.max(0, Math.min(1, baseRow["Answer Relevancy"] + variation)),
          Length: Math.max(0, Math.min(1, baseRow.Length + variation)),
          Tone: Math.max(0, Math.min(1, baseRow.Tone + variation)),
          isSimulated: true // 시뮬레이션 데이터
        });
      }
    }
    
    const simulatedCount = allRows.filter(row => row.isSimulated).length;
    const realCount = allRows.filter(row => !row.isSimulated).length;
    
    console.log(`📈 Generated data: ${realCount} real + ${simulatedCount} simulated = ${allRows.length} total`);
    
    return allRows.sort((a, b) => a.Date.localeCompare(b.Date));
  }
  
  // 더 안전한 방법: 실제 데이터의 최신 날짜를 기준으로 하기
  function generateExtendedDataWithMode(realRows: DailyRow[], mode: EstimationMode): DailyRow[] {
    const allRows: DailyRow[] = [];
    
    // 실제 데이터의 최신 날짜와 오늘 중 빠른 날짜를 기준으로 함
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let latestRealDate = today;
    if (realRows.length > 0) {
      const latestReal = new Date(realRows[realRows.length - 1].Date);
      latestRealDate = latestReal < today ? latestReal : today;
    }
    
    // 기준 날짜로부터 과거 30일 생성
    for (let i = 29; i >= 0; i--) {
      const date = new Date(latestRealDate.getTime() - (i * 24 * 60 * 60 * 1000));
      const dateStr = date.toISOString().split('T')[0];
      
      const realRow = realRows.find(row => row.Date === dateStr);
      
      if (realRow) {
        allRows.push(realRow);
      } else {
        const baseRow = realRows[realRows.length - 1] || getDefaultBaseRow();
        
        let simulatedRow: DailyRow;
        
        switch (mode) {
          case 'simple':
            simulatedRow = generateSimpleVariation(baseRow, dateStr);
            break;
          case 'improved':
            simulatedRow = generateImprovedVariation(baseRow, dateStr, i);
            break;
          case 'realistic':
            simulatedRow = generateRealisticVariation(baseRow, dateStr, i);
            break;
          default:
            simulatedRow = generateSimpleVariation(baseRow, dateStr);
        }
        
        allRows.push(simulatedRow);
      }
    }
    
    const simulatedCount = allRows.filter(row => row.isSimulated).length;
    const realCount = allRows.filter(row => !row.isSimulated).length;
    
    console.log(`📈 Generated data (${mode}): ${realCount} real + ${simulatedCount} simulated = ${allRows.length} total`);
    
    return allRows.sort((a, b) => a.Date.localeCompare(b.Date));
  }

  // 1. Simple: 기존 방식 (±5% 랜덤)
  function generateSimpleVariation(baseRow: DailyRow, dateStr: string): DailyRow {
    const variation = (Math.random() - 0.5) * 0.1; // ±5%
    
    return {
      Date: dateStr,
      Toxicity: Math.max(0, Math.min(1, baseRow.Toxicity + variation)),
      "Prompt Injection": Math.max(0, Math.min(1, baseRow["Prompt Injection"] + variation)),
      "Answer Correctness": Math.max(0, Math.min(1, baseRow["Answer Correctness"] + variation)),
      "Answer Relevancy": Math.max(0, Math.min(1, baseRow["Answer Relevancy"] + variation)),
      Length: Math.max(0, Math.min(1, baseRow.Length + variation)),
      Tone: Math.max(0, Math.min(1, baseRow.Tone + variation)),
      isSimulated: true
    };
  }

  // 2. Improved: 변동폭 줄이고 패턴 추가
  function generateImprovedVariation(baseRow: DailyRow, dateStr: string, dayIndex: number): DailyRow {
    const variation = (Math.random() - 0.5) * 0.08; // ±4%로 줄임
    const weeklyTrend = Math.sin((dayIndex / 7) * Math.PI) * 0.02; // 주간 패턴
    const totalVariation = variation + weeklyTrend;
    
    return {
      Date: dateStr,
      Toxicity: Math.max(0, Math.min(1, baseRow.Toxicity + totalVariation * 0.5)), // 독성은 더 안정적
      "Prompt Injection": Math.max(0, Math.min(1, baseRow["Prompt Injection"] + totalVariation * 0.5)),
      "Answer Correctness": Math.max(0, Math.min(1, baseRow["Answer Correctness"] + totalVariation)),
      "Answer Relevancy": Math.max(0, Math.min(1, baseRow["Answer Relevancy"] + totalVariation)),
      Length: Math.max(0, Math.min(1, baseRow.Length + totalVariation * 1.2)), // 길이는 더 변동적
      Tone: Math.max(0, Math.min(1, baseRow.Tone + totalVariation * 1.2)),
      isSimulated: true
    };
  }

  // 3. Realistic: 메트릭별 다른 패턴 + 트렌드
  function generateRealisticVariation(baseRow: DailyRow, dateStr: string, dayIndex: number): DailyRow {
    const daysSinceBase = Math.abs(dayIndex - 29);
    const trendFactor = 1 - (daysSinceBase * 0.005); // 시간 경과에 따른 변화
    
    // 각 메트릭별로 다른 변형 패턴
    const toxicityVariation = (Math.random() - 0.5) * 0.03; // 독성: 매우 안정적
    const accuracyVariation = (Math.random() - 0.5) * 0.06; // 정확도: 보통 변동
    const toneVariation = (Math.random() - 0.5) * 0.10; // 톤: 가장 변동적
    
    // 요일 패턴 (주말에 성능 약간 달라짐)
    const date = new Date(dateStr);
    const dayOfWeek = date.getDay();
    const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.95 : 1.0; // 주말에 약간 낮음
    
    return {
      Date: dateStr,
      Toxicity: Math.max(0, Math.min(1, baseRow.Toxicity * trendFactor * weekendFactor + toxicityVariation)),
      "Prompt Injection": Math.max(0, Math.min(1, baseRow["Prompt Injection"] * trendFactor * weekendFactor + toxicityVariation)),
      "Answer Correctness": Math.max(0, Math.min(1, baseRow["Answer Correctness"] * trendFactor * weekendFactor + accuracyVariation)),
      "Answer Relevancy": Math.max(0, Math.min(1, baseRow["Answer Relevancy"] * trendFactor * weekendFactor + accuracyVariation)),
      Length: Math.max(0, Math.min(1, baseRow.Length * trendFactor + toneVariation)),
      Tone: Math.max(0, Math.min(1, baseRow.Tone * trendFactor + toneVariation)),
      isSimulated: true
    };
  }
  
  function getDefaultBaseRow(): DailyRow {
    return {
      Date: '',
      Toxicity: 0.8,
      "Prompt Injection": 0.85,
      "Answer Correctness": 0.8,
      "Answer Relevancy": 0.85,
      Length: 0.7,
      Tone: 0.75,
      isSimulated: false
    };
  }
  
  function generateDummyRadarData(): DailyRow[] {
    console.log('🎲 Generating dummy radar data...');
    const rows: DailyRow[] = [];
    
    // 오늘 날짜를 00:00:00으로 설정
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    for (let i = 30; i >= 0; i--) {
      const date = new Date(today.getTime() - (i * 24 * 60 * 60 * 1000));
      const dateStr = date.toISOString().split('T')[0];
      
      rows.push({
        Date: dateStr,
        Toxicity: Math.random() * 0.3 + 0.7,
        "Prompt Injection": Math.random() * 0.2 + 0.8,
        "Answer Correctness": Math.random() * 0.2 + 0.8,
        "Answer Relevancy": Math.random() * 0.15 + 0.85,
        Length: Math.random() * 0.3 + 0.7,
        Tone: Math.random() * 0.25 + 0.75,
        isSimulated: true
      });
    }
    
    console.log('✅ Generated', rows.length, 'dummy rows');
    return rows;
  }
  
  // 시뮬레이션 데이터 필터링 함수
  export function filterSimulatedData(rows: DailyRow[], includeSimulated: boolean): DailyRow[] {
    if (includeSimulated) {
      return rows;
    } else {
      return rows.filter(row => !row.isSimulated);
    }
  }