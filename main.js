/**
 * このスクリプトは、OSMDを初期化し、
 * ユーザーがアップロードしたMusicXMLを読み込み、
 * 小節のハイライト機能を追加します。
 */

document.addEventListener("DOMContentLoaded", () => {

    // --- 1. DOM要素の取得 ---
    const osmdContainer = document.getElementById("osmd-container");
    const fileInput = document.getElementById("musicXmlFileInput");

    // --- 2. OSMDの初期化 ---
    const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(osmdContainer, {
        autoResize: true,
        backend: "svg",
        drawTitle: true,
        // ハイライトに必須
        drawMeasureBackgrounds: true 
    });

    // --- 3. ファイル選択時のイベントリスナー ---
    fileInput.addEventListener("change", (event) => {
        const file = event.target.files[0];
        if (!file) {
            return; // ファイルが選択されていない
        }

        // FileReaderを使ってファイル内容を読み込む
        const reader = new FileReader();

        reader.onload = async (e) => {
            const xmlContent = e.target.result;
            
            // 既存の楽譜をクリア
            osmd.clear(); 
            
            // 読み込んだ内容で楽譜を読み込み、描画
            await loadAndRenderScore(xmlContent); 
        };
        
        reader.onerror = (e) => {
            console.error("File reading failed:", e);
            osmdContainer.textContent = "ファイルの読み込みに失敗しました。";
        };

        // ファイルをテキストとして読み込む
        reader.readAsText(file);
    });

    // --- 4. メイン処理：楽譜の読み込みと描画 (XML文字列を引数に取る) ---
    async function loadAndRenderScore(xmlContent) {
        try {
            // XML文字列から直接読み込み
            await osmd.load(xmlContent);
            
            // 読み込みが完了したら描画
            await osmd.render();

            console.log("楽譜の描画が完了しました。ハイライト機能を設定します。");
            
            // 描画された楽譜にハイライト機能を追加
            setupMeasureHighlighting(osmd);

        } catch (error) {
            console.error("楽譜の読み込みまたは描画に失敗しました:", error);
            // エラー内容をコンテナに表示
            osmdContainer.textContent = `楽譜の描画に失敗しました: ${error.message}`;
        }
    }

    // --- 5. ハイライト機能の設定 (内容は前回のものと同じ) ---
    
    /**
     * 描画された全ての小節にマウスイベントを設定します。
     * @param {opensheetmusicdisplay.OpenSheetMusicDisplay} osmdInstance
     */
    function setupMeasureHighlighting(osmdInstance) {
        const allMeasures = osmdInstance.graphic.measureList;

        allMeasures.forEach(measure => {
            const measureSvgElement = measure.drawingParameters.svg;

            measureSvgElement.addEventListener("mouseover", () => {
                const currentMeasureNumber = measure.MeasureNumber;
                highlightMeasuresByNumber(allMeasures, currentMeasureNumber);
            });

            measureSvgElement.addEventListener("mouseout", () => {
                clearAllHighlights(allMeasures);
            });
        });
    }

    /**
     * 指定された小節番号を持つすべての小節をハイライト（CSSクラスを付与）します。
     */
    function highlightMeasuresByNumber(allMeasures, measureNumber) {
        allMeasures.forEach(measure => {
            const svgElement = measure.drawingParameters.svg;
            if (measure.MeasureNumber === measureNumber) {
                svgElement.classList.add("highlighted-measure");
            } else {
                svgElement.classList.remove("highlighted-measure");
            }
        });
    }

    /**
     * すべての小節のハイライト（CSSクラス）を解除します。
     */
    function clearAllHighlights(allMeasures) {
        allMeasures.forEach(measure => {
            measure.drawingParameters.svg.classList.remove("highlighted-measure");
        });
    }

    // ページ読み込み時は、ファイル選択を待機する
    osmdContainer.textContent = "MusicXMLファイルをアップロードしてください。";
});