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
/**
     * [ステップ1のコア]
     * 1つの小節 (SourceMeasure) から一C意の「指紋」文字列を生成する
     * @param {SourceMeasure} measure
     * @returns {string} この小節のフィンガープリント
     */
/**
 * [ステップ1のコア]
 * 1つの小節 (SourceMeasure) から一意の「指紋」文字列を生成する
 * @param {SourceMeasure} measure
 * @returns {string} この小節のフィンガープリント
 */
function createFingerprint(measure) {
    let fingerprint = "";

    // measure.staffEntries が null や undefined でないか確認
    if (measure.staffEntries) {

        for (const entry of measure.staffEntries) {

            // entry.voiceEntries も同様に確認
            if (entry.voiceEntries) {
                for (const voice of entry.voiceEntries) {

                    // voice.notes も同様に確認
                    if (voice.notes) {
                        for (const note of voice.notes) {
                            if (note.isRest) {
                                // ★ 修正: .toString() を使用
                                fingerprint += `r:${note.Length.toString()};`; // 例: "r:1/4;"
                            } else if (note.Pitch) {
                                // ★ 修正: .toString() を使用
                                // note.Pitch.FullnameString は "C#4" など
                                // note.Length.toString() は "1/4" など
                                fingerprint += `n:${note.Pitch.FullnameString}:${note.Length.toString()};`;
                            }
                        }
                    }
                }
            }
            fingerprint += "|"; // 垂直スライス間の区切り文字
        }
    }

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
/**
     * [ステップ3: 動的ハイライト - ハンドラ]
     * マウスが小節に乗った時の処理
     * @param {number} measureNumber - マウスオーバーされた小節の番号
     */
function handleMouseOver(measureNumber) {
    const fingerprint = measureFingerprintMap.get(measureNumber);
    if (!fingerprint) return;

    // --- ★ デバッグ用コード ★ ---
    // ブラウザの「開発者ツール」の「コンソール」に
    // マウスオーバーした小節の情報を出力します。
    console.log(`Measure: ${measureNumber}, Fingerprint: ${fingerprint}`);
    // -------------------------

    const identicalMeasures = fingerprintGroupMap.get(fingerprint);

    if (identicalMeasures && identicalMeasures.length > 1) {
        highlightMeasures(identicalMeasures, "red");
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
/**
     * [ステップ3: 動的ハイライト - 実行部]
     * 指定された小節番号リストの「音符の色」を変更する
     * @param {number[]} measureNumbers - 色を変えたい小節番号の配列
     * @param {string | null} color - "red" などのCSS色。nullの場合はデフォルト色(黒)に戻す
     */
function highlightMeasures(measureNumbers, color) {
    const defaultColor = "#000000"; // OSMDのデフォルトは黒
    const targetColor = color || defaultColor;

    for (const measure of osmd.sheet.SourceMeasures) {
        if (measureNumbers.includes(measure.MeasureNumber)) {

            const graphicalMeasure = measure.graphicalMeasure;
            if (!graphicalMeasure) continue;

            graphicalMeasure.staffEntries.forEach(gStaffEntry => {
                gStaffEntry.graphicalNotes.forEach(gNote => {

                    // ★ 修正: OSMDの公式メソッド setColour を使用
                    // これにより符頭、符幹、符尾がすべて色付けされる
                    gNote.setColour(targetColor);

                    // setColour は自動で再描画しないため、
                    // 関連するSVG要素のスタイルを直接変更する
                    if (gNote.svgElement) {
                        gNote.svgElement.style.fill = targetColor;
                    }
                });
            });
        }
    }

    // ★ 追加: 変更をSVGに即時反映させる
    // (setColourだけでは描画が変わらない場合があるため)
    // ただし、この方法は重い可能性があるので、まずは setColour と
    // svgElement.style.fill だけで試し、ダメなら osmd.render() を使う

    // osmd.render(); // <- これを呼ぶと確実だが、遅くなる
}