/**
 * このスクリプトは、OSMDを初期化し、MusicXMLを読み込み、
 * 小節のハイライト機能を追加します。
 */

// DOMが読み込まれたら処理を開始
document.addEventListener("DOMContentLoaded", () => {

    // --- 1. サンプルMusicXMLファイルのURL ---
    // GitHub Pagesで動作させるため、CORSが許可されたURLを使用します。
    // (OSMDのデモ用ファイルを利用)
    const musicXmlUrl = "https://opensheetmusicdisplay.github.io/demo/sheets/MuzioClementi_SonatinaOpus36No1_Part1.xml";
    // もしご自身の .xml ファイルを試す場合は、
    // ご自身のGitHubリポジトリに含めて、以下のように相対パスで指定できます。
    // const musicXmlUrl = "./my-score.xml";

    // --- 2. OSMDの初期化 ---
    const osmdContainer = document.getElementById("osmd-container");
    const osmd = new opensheetmusicdisplay.OpenSheetMusicDisplay(osmdContainer, {
        // 自動でコンテナの幅にリサイズ
        autoResize: true, 
        // 背景を透明に (CSSでコントロールするため)
        backend: "svg",
        drawTitle: true,
        // 小節の背景レイヤーを描画 (ハイライトに必須)
        drawMeasureBackgrounds: true 
    });

    // --- 3. メイン処理：楽譜の読み込みと描画 ---
    async function loadAndRenderScore() {
        try {
            // 楽譜データを非同期で読み込み
            await osmd.load(musicXmlUrl);
            
            // 読み込みが完了したら描画
            // .render() も非同期（Promise）を返すので、
            // 描画完了を待ってからイベントリスナーを設定します。
            await osmd.render();

            console.log("楽譜の描画が完了しました。ハイライト機能を設定します。");
            
            // 描画された楽譜にハイライト機能を追加
            setupMeasureHighlighting(osmd);

        } catch (error) {
            console.error("楽譜の読み込みまたは描画に失敗しました:", error);
            osmdContainer.textContent = "楽譜の読み込みに失敗しました。";
        }
    }

    // --- 4. ハイライト機能の設定 ---
    /**
     * 描画された全ての小節にマウスイベントを設定します。
     * @param {opensheetmusicdisplay.OpenSheetMusicDisplay} osmdInstance
     */
    function setupMeasureHighlighting(osmdInstance) {
        // 描画された全小節のリスト (GraphicalMeasure オブジェクトの配列)
        const allMeasures = osmdInstance.graphic.measureList;

        allMeasures.forEach(measure => {
            // 各小節が持つSVG要素 (<g> タグ)
            const measureSvgElement = measure.drawingParameters.svg;

            // (A) マウスが小節の上に乗った時の処理
            measureSvgElement.addEventListener("mouseover", () => {
                const currentMeasureNumber = measure.MeasureNumber;
                highlightMeasuresByNumber(allMeasures, currentMeasureNumber);
            });

            // (B) マウスが小節から離れた時の処理
            measureSvgElement.addEventListener("mouseout", () => {
                clearAllHighlights(allMeasures);
            });
        });
    }

    /**
     * 指定された小節番号を持つすべての小節をハイライト（CSSクラスを付与）します。
     * @param {Array} allMeasures - OSMDの全GraphicalMeasureの配列
     * @param {number} measureNumber - ハイライト対象の小節番号
     */
    function highlightMeasuresByNumber(allMeasures, measureNumber) {
        allMeasures.forEach(measure => {
            const svgElement = measure.drawingParameters.svg;
            if (measure.MeasureNumber === measureNumber) {
                // SVG要素に 'highlighted-measure' クラスを追加
                svgElement.classList.add("highlighted-measure");
            } else {
                // 念のため、他の小節からはクラスを削除
                svgElement.classList.remove("highlighted-measure");
            }
        });
    }

    /**
     * すべての小節のハイライト（CSSクラス）を解除します。
     * @param {Array} allMeasures - OSMDの全GraphicalMeasureの配列
     */
    function clearAllHighlights(allMeasures) {
        allMeasures.forEach(measure => {
            measure.drawingParameters.svg.classList.remove("highlighted-measure");
        });
    }

    // --- 実行 ---
    loadAndRenderScore();

});