/*
 * 🟢 IPPure 风险详情面板
 * 
 * 功能：检测当前节点的 IP 纯净度、风险评分及类型（家宽/数据中心）。
 * 数据源：https://ippure.com
 * 
 * 适配：Surge, Loon, Quantumult X, Stash
 * 
 * 📝 配置示例:
 * 
 * [Surge]
 * Panel:
 * IPPure = script-name=IPPure, update-interval=600, title="IP 纯净度检测", content="正在刷新...", icon=shield.checkerboard, icon-color=#007AFF
 * 
 * Script:
 * IPPure = type=generic, timeout=10, script-path=https://raw.githubusercontent.com/your-repo/ippure_panel.js
 * 
 * [Loon]
 * Script:
 * params:
 *   - cron: "0 0 * * *"
 *   - timeout: 10
 *   - tag: IPPure
 * 
 * [Quantumult X]
 * 请使用转换后的重写或脚本配置。
 */

const API_URL = "https://my.ippure.com/v1/info";

// 统一 HTTP 请求方法
const get = (options, callback) => {
    if (typeof $httpClient !== "undefined") {
        $httpClient.get(options, callback);
    } else if (typeof $task !== "undefined") {
        $task.fetch(options).then(
            (response) => { callback(null, response, response.body); },
            (reason) => { callback(reason.error, null, null); }
        );
    } else {
        callback("Unsupported Environment", null, null);
    }
};

// 统一完成方法
const done = (value = {}) => {
    if (typeof $done !== "undefined") {
        $done(value);
    }
};

get({ url: API_URL }, (error, response, data) => {
    if (error) {
        console.log(`❌ 请求失败: ${error}`);
        done({
            title: "IPPure 检测失败",
            content: "无法连接到 API，请检查网络或节点连通性。",
            icon: "exclamationmark.triangle",
            "icon-color": "#FF2D55"
        });
        return;
    }

    try {
        const info = JSON.parse(data);

        // 1. 提取基础信息
        const ip = info.ip || "N/A";
        const country = info.countryCode || "VN"; // 默认或者从 info 获取
        const flag = getFlagEmoji(info.countryCode);
        const city = info.city || "";
        const isp = info.asOrganization || "未知 ISP";

        // 2. 提取风险及类型信息
        // 修正：如果 API 不返回 isResidential (undefined)，则不能断定是数据中心，应显示未知
        const score = info.fraudScore !== undefined ? info.fraudScore : null;
        const isResidential = info.isResidential;
        // const isRelay = info.isProxy === true || info.isVpn === true; // 有些库会有这些字段

        // 3. 判定等级与UI风格
        let riskLevel = "";
        let iconColor = "";
        let icon = "";
        let riskDesc = "";

        if (score === null) {
            riskLevel = "❓ 数据缺失";
            iconColor = "#8E8E93"; // Gray
            icon = "questionmark.circle";
            riskDesc = "无评分";
        } else if (score < 15) {
            riskLevel = "💎 极度纯净";
            iconColor = "#30D158"; // Bright Green
            icon = "checkmark.shield.fill";
            riskDesc = "极度纯净";
        } else if (score < 30) {
            riskLevel = "✅ 纯净 (低风险)";
            iconColor = "#30D158"; // Green
            icon = "checkmark.shield.fill";
            riskDesc = "低风险";
        } else if (score < 60) {
            riskLevel = "⚠️ 一般 (中风险)";
            iconColor = "#FF9F0A"; // Orange
            icon = "exclamationmark.shield.fill";
            riskDesc = "中风险";
        } else {
            riskLevel = "🚫 危险 (高风险)";
            iconColor = "#FF453A"; // Red
            icon = "xmark.shield.fill";
            riskDesc = "高风险";
        }

        // 4. 类型标签 (依据用户提供的截图校准)
        // isResidential: true -> 住宅IP
        // isBroadcast: false -> 原生IP
        const typeTags = [];

        if (isResidential === true) {
            typeTags.push("🏠 住宅IP");
        } else if (isResidential === false) {
            typeTags.push("🏢 机房IP");
        } else {
            typeTags.push("❓ 未知类型");
        }

        // IP来源判断
        if (info.isBroadcast === true) {
            typeTags.push("📢 广播IP");
        } else if (info.isBroadcast === false) {
            typeTags.push("🌱 原生IP");
        }

        // 5. 组装显示内容
        // 标题：IP + 国旗 + 风险简述
        const panelTitle = `IPPure: ${score === null ? 'N/A' : score}分 | ${flag} ${info.countryCode || ''}`;

        // 内容：详情
        let panelContent = `IP: ${ip}\n`;
        panelContent += `风险: ${riskDesc} (${score === null ? '无数据' : score})\n`;
        panelContent += `类型: ${typeTags.join(" ")}\n`;
        panelContent += `ISP: ${isp}`;

        // 控制台日志，方便调试
        console.log(`IPPure Check: ${ip} | Score: ${score} | Type: ${isResidential ? 'Residential' : 'DC'} | ISP: ${isp}`);

        done({
            title: panelTitle,
            content: panelContent,
            icon: icon,
            "icon-color": iconColor
        });

    } catch (e) {
        console.log(`❌ 解析失败: ${e.message}`);
        done({
            title: "IPPure 解析错误",
            content: "API 返回数据格式异常或非 JSON 数据。",
            icon: "files",
            "icon-color": "#FF2D55"
        });
    }
});

function getFlagEmoji(countryCode) {
    if (!countryCode) return "🌍";
    const codePoints = countryCode
        .toUpperCase()
        .split('')
        .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
}
