// --- グローバル変数 ---
let osmd;
// Map<MeasureNumber, Fingerprint>
const measureFingerprintMap = new Map(); 
// Map<Fingerprint, MeasureNumber[]>
const fingerprintGroupMap = new Map(); 

const fileInput = document.getElementById("file-input");
const loadingStatus = document.getElementById("loading-status");
const scoreContainer = document.getElementById("score-container");

// --- 初期化 ---

// OSMDインスタンスを初期化
osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(scoreContainer, {
    autoResize: true,
    backend: "svg",
    drawTitle: true,
});

// ファイルが選択された時のイベントリスナー
fileInput.addEventListener("change", (event) => {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    loadingStatus.textContent = "ファイルを読み込み中...";

    const reader = new FileReader();
    reader.onload = (e) => {
        const musicxmlData = e.target.result;
        loadScore(musicxmlData);
    };
    reader.readAsText(file);
});


/**
 * 楽譜を読み込み、分析し、描画するメイン関数
 * @param {string} musicxmlData - MusicXMLのファイル内容
 */
async function loadScore(musicxmlData) {
    loadingStatus.textContent = "楽譜を解析しています...";
    
    // マップをリセット
    measureFingerprintMap.clear();
    fingerprintGroupMap.clear();

    try {
        // 1. 楽譜データをOSMDに読み込ませる
        await osmd.load(musicxmlData);
        
        // 2. 楽譜を分析してフィンガープリント・マップを作成 (★重要)
        analyzeScore(osmd);
        
        loadingStatus.textContent = "楽譜を描画しています...";
        
        // 3. 楽譜をSVGとして描画
        // (注: render()は非同期ではない場合があるが、将来に備えawait)
        await osmd.render(); 
        
        // 4. 描画されたSVGにマウスイベントを登録 (★重要)
        setupMouseEvents(osmd);

        loadingStatus.textContent = "読み込み完了。小節にマウスを乗せてください。";
    } catch (error) {
        console.error("楽譜の読み込みまたは描画に失敗しました:", error);
        loadingStatus.textContent = `エラー: ${error.message}`;
    }
}


/**
 * [ステップ1: 分析]
 * 楽譜の全小節を分析し、フィンガープリントのマップを作成する
 * @param {OpenSheetMusicDisplay} osmdInstance
 */
function analyzeScore(osmdInstance) {
    // OSMDの内部データ構造 (SourceMeasure) にアクセス
    const measures = osmdInstance.sheet.SourceMeasures;

    for (const measure of measures) {
        const measureNumber = measure.MeasureNumber;
        
        // 1A. この小節の「指紋」を作成
        const fingerprint = createFingerprint(measure);
        
        // 1B. 2つのマップを構築
        measureFingerprintMap.set(measureNumber, fingerprint);

        if (!fingerprintGroupMap.has(fingerprint)) {
            fingerprintGroupMap.set(fingerprint, []);
        }
        fingerprintGroupMap.get(fingerprint).push(measureNumber);
    }

    // デバッグ用: どの小節がグループ化されたかコンソールに表示
    console.log("--- 楽譜分析結果 ---");
    fingerprintGroupMap.forEach((measures, fp) => {
        if (measures.length > 1) {
            console.log(`重複グループ (${measures.length}個): ${measures.join(", ")}`);
        }
    });
    console.log("--------------------");
}

/**
 * [ステップ1のコア]
 * 1つの小節 (SourceMeasure) から一意の「指紋」文字列を生成する
 * @param {SourceMeasure} measure
 * @returns {string} この小節のフィンガープリント
 */
function createFingerprint(measure) {
    let fingerprint = "";

    // 小節内の全ての「垂直スライス」(StaffEntry) をループ
    for (const entry of measure.staffEntries) {
        // スライス内の全ての「声部」(VoiceEntry) をループ
        for (const voice of entry.voiceEntries) {
            // 声部内の全ての「音符」(Note) をループ
            for (const note of voice.notes) {
                if (note.isRest) {
                    // 休符の場合
                    fingerprint += `r:${note.Length.Fractional};`; // 例: "r:0.25;" (4分休符)
                } else if (note.Pitch) {
                    // 音符の場合
                    // Pitch.FullnameString は "C#4" のような絶対音名
                    // Length.Fractional は 1.0 (全音符), 0.25 (4分音符) などの数値
                    fingerprint += `n:${note.Pitch.FullnameString}:${note.Length.Fractional};`;
                }
            }
        }
        fingerprint += "|"; // 垂直スライス間の区切り文字
    }
    
    // (注: この簡易ロジックはタイ、連符、歌詞、奏法記号を区別しません。
    //  より厳密にするには、これらの情報もフィンガープリントに含める必要があります)
    
    return fingerprint;
}


/**
 * [ステップ2: イベント登録]
 * 描画された全小節のSVG要素にマウスイベントを登録する
 * @param {OpenSheetMusicDisplay} osmdInstance
 */
function setupMouseEvents(osmdInstance) {
    osmdInstance.sheet.SourceMeasures.forEach(measure => {
        // SourceMeasure (論理) から GraphicalMeasure (描画) を取得
        const graphicalMeasure = measure.graphicalMeasure;
        
        if (graphicalMeasure && graphicalMeasure.svgElement) {
            const measureNumber = measure.MeasureNumber;

            // マウスが乗った時の処理
            graphicalMeasure.svgElement.addEventListener("mouseover", () => {
                handleMouseOver(measureNumber);
            });
            
            // マウスが離れた時の処理
            graphicalMeasure.svgElement.addEventListener("mouseout", () => {
                handleMouseOut(measureNumber);
            });
        }
    });
}


/**
 * [ステップ3: 動的ハイライト - ハンドラ]
 * マウスが小節に乗った時の処理
 * @param {number} measureNumber - マウスオーバーされた小節の番号
 */
function handleMouseOver(measureNumber) {
    const fingerprint = measureFingerprintMap.get(measureNumber);
    if (!fingerprint) return;

    const identicalMeasures = fingerprintGroupMap.get(fingerprint);
    
    // 重複が2つ以上ある場合のみハイライト
    if (identicalMeasures && identicalMeasures.length > 1) {
        highlightMeasures(identicalMeasures, "red"); // ハイライト色
    }
}

/**
 * [ステップ3: 動的ハイライト - ハンドラ]
 * マウスが小節から離れた時の処理
 * @param {number} measureNumber - マウスアウトした小節の番号
 */
function handleMouseOut(measureNumber) {
    const fingerprint = measureFingerprintMap.get(measureNumber);
    if (!fingerprint) return;

    const identicalMeasures = fingerprintGroupMap.get(fingerprint);

    // ハイライトを解除 (デフォルト色に戻す)
    if (identicalMeasures) {
        highlightMeasures(identicalMeasures, null);
    }
}

/**
 * [ステップ3: 動的ハイライト - 実行部]
 * 指定された小節番号リストの「音符の色」を変更する
 * @param {number[]} measureNumbers - 色を変えたい小節番号の配列
 * @param {string | null} color - "red" などのCSS色。nullの場合はデフォルト色(黒)に戻す
 */
function highlightMeasures(measureNumbers, color) {
    const defaultColor = "black";
    const targetColor = color || defaultColor;

    for (const measure of osmd.sheet.SourceMeasures) {
        // 対象の小節番号の配列に含まれているか
        if (measureNumbers.includes(measure.MeasureNumber)) {
            
            const graphicalMeasure = measure.graphicalMeasure;
            if (!graphicalMeasure) continue;

            // 描画された小節 (GraphicalMeasure) 内の全ての譜 (StaffEntry) をループ
            graphicalMeasure.staffEntries.forEach(gStaffEntry => {
                // 譜内の全ての音符 (GraphicalNote) をループ
                gStaffEntry.graphicalNotes.forEach(gNote => {
                    if (gNote.svgElement) {
                        // 音符のSVG要素（通常は <path>）の fill (塗りつb) 属性を変更
                        gNote.svgElement.style.fill = targetColor;
                    }
                });
            });
        }
    }
}
