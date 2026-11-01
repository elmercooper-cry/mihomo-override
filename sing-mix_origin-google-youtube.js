/*
 * The sing-mix project
 * Sakyvo Present
 * 仓库地址：https://github.com/Sakyvo/sing-mix
 * 脚本链接：https://raw.githubusercontent.com/Sakyvo/sing-mix/refs/heads/main/sing-mix_origin
 * mihomo客户端推荐：https://github.com/appshubcc/Bettbox
*/

// ====================
// 0. 特殊处理
// ====================

/// 强制直连
const BYPASS_DOMAINS = [
  "example.com", "example.org"
];

// 强制代理
const FORCE_PROXY_DOMAINS = [
  "test.com", "test.org"
];

// 强制屏蔽
const CUSTOM_BLOCK_DOMAINS = [ "blocked.com", "blocked.org"
];

// 自定义节点过滤（用 | 分割）
const CUSTOM_FILTER = /示例占位符1|示例占位符2|示例占位符3/

// ====================
// 1. 常量配置
// ====================

const SETTINGS = {
  ICON_BASE: "https://fastly.jsdelivr.net/gh/Koolson/Qure@master/IconSet/Color/",
  RULE_PROVIDER_URL_BASE: "https://fastly.jsdelivr.net/gh/MetaCubeX/meta-rules-dat@meta/geo",

  REGION_ORDER: ["HK", "TW", "SG", "JP", "KR", "AS", "US", "CUSTOM"],

  URL_TEST_EXTRA: {
    hidden: true,
    url: "https://www.g.cn/generate_204",
    interval: 900,
    tolerance: 100,
    lazy: true,
    timeout: 750,
    "max-failed-times": 1,
  },

  FALLBACK_TEST_EXTRA: {
    url: "https://www.g.cn/generate_204",
    interval: 900,
    lazy: true,
    timeout: 750,
    "max-failed-times": 1,
  },

  INFO_FILTER: /mcii-keep|tg|telegram|倒卖|到期|电报|订阅|发布|防止|返利|购买|官方|官网|工单|过期|规则|建议|客服|联系|流量|剩余|失联|网址|邮箱|续费|邀请|重置|梯子|群|永久免费|节点来自/i
};

// ====================
// 2. 基础工具
// ====================

const uniq = (arr = []) => [...new Set(arr.filter(Boolean))];

// 可能导致内核 go-yaml 报错的字符:
const UNSAFE_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F-\u009F\uFFFE\uFFFF]|[\uD800-\uDFFF]/;

// 剔除字符串中的非法控制字符（保留 \t \n \r）与孤立代理对
const sanitizeString = (value = "") => {
  if (typeof value !== "string" || !value || !UNSAFE_CHARS_RE.test(value)) return value;

  let out = "";
  for (let i = 0; i < value.length; i++) {
    const c = value.charCodeAt(i);

    if (c >= 0xd800 && c <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += value[i] + value[i + 1];
        i++;
      }
      continue;
    }
    if (c >= 0xdc00 && c <= 0xdfff) continue;

    if (
      (c <= 0x1f && c !== 0x09 && c !== 0x0a && c !== 0x0d) ||
      c === 0x7f ||
      (c >= 0x80 && c <= 0x9f) ||
      c === 0xfffe ||
      c === 0xffff
    ) {
      continue;
    }

    out += value[i];
  }

  return out;
};

// 递归清洗配置对象的所有字符串键值，避免序列化后内核报 `yaml: control characters are not allowed`

const sanitizeConfig = (value) => {
  if (typeof value === "string") return sanitizeString(value);
  if (Array.isArray(value)) return value.map(sanitizeConfig);
  if (value && typeof value === "object") {
    const out = {};
    for (const key in value) {
      out[sanitizeString(key)] = sanitizeConfig(value[key]);
    }
    return out;
  }
  return value;
};

const escapeRegex = (s = "") =>
  String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const normalizeName = (name = "") =>
  String(name)
    .replace(/(IEPL|IPLC|BGP|RELAY|PRO|V\d+)/ig, " $1 ")
    .replace(/[【】\[\]（）()|_\-.,/:~]/g, " ")
    .replace(/🇭🇰/g, " HK ")
    .replace(/🇹🇼/g, " TW ")
    .replace(/🇸🇬/g, " SG ")
    .replace(/🇯🇵/g, " JP ")
    .replace(/🇰🇷/g, " KR ")
    .replace(/🇻🇳|🇹🇭|🇲🇾|🇮🇩|🇵🇭/g, " AS ")
    .replace(/🇺🇸/g, " US ")
    .toUpperCase()
    .replace(/\s+/g, " ")
    .trim();

const buildRegex = (arr = []) =>
  new RegExp(
    arr
      .map((raw) => {
        const token = String(raw).trim().toUpperCase();
        const escaped = escapeRegex(token);
        return /^[A-Z]{2,3}$/.test(token)
          ? `(?:^|[^A-Z])${escaped}(?:[^A-Z]|$)`
          : escaped;
      })
      .join("|"),
    "i"
  );

const buildRegions = () =>
  ([
    { name: "HK", pattern: ["香港", "HK", "HKG", "HKT", "HONGKONG", "HONG KONG"], icon: "Hong_Kong.png" },
    { name: "TW", pattern: ["台湾", "台北", "新北", "TW", "TWN", "TAIWAN", "TAIPEI"], icon: "Taiwan.png" },
    { name: "SG", pattern: ["新加坡", "狮城", "SG", "SGP", "SINGAPORE"], icon: "Singapore.png" },
    { name: "JP", pattern: ["日本", "东京", "大阪", "JP", "JPN", "JAPAN", "TOKYO", "OSAKA"], icon: "Japan.png" },
    { name: "KR", pattern: ["韩国", "首尔", "KR", "KOR", "KOREA", "SEOUL"], icon: "Korea.png" },
    { name: "CUSTOM", pattern: ["哄哄", "热气球"], icon: "Area.png" },
    {
      name: "AS",
      pattern: [
        "越南", "泰国", "马来西亚", "印尼", "菲律宾",
        "VN", "TH", "MY", "ID", "PH",
        "VIETNAM", "THAILAND", "MALAYSIA", "INDONESIA", "PHILIPPINES", "MANILA"
      ],
      icon: "Asia_Map.png"
    },
    {
      name: "US",
      pattern: [
        "美国", "纽约", "旧金山", "洛杉矶", "西雅图", "芝加哥",
        "US", "USA", "United States",
        "NEWYORK", "NEW YORK",
        "SANFRANCISCO", "SAN FRANCISCO",
        "LOSANGELES", "LOS ANGELES",
        "SEATTLE", "CHICAGO"
      ],
      icon: "United_States.png"
    }
  ]).map((r) => ({ ...r, regex: buildRegex(r.pattern) }));

const REGIONS = buildRegions();

const buildFakeIpFilter = (bypass = []) =>
  uniq([
    "rule-set:private",
    "rule-set:google-cn",
    "rule-set:synology",
    "rule-set:cn",
    ...uniq(
      bypass.flatMap((domain) => {
        const d = String(domain || "").trim();
        if (!d) return [];
        return d.includes("*") || d.startsWith("+.") ? [d] : [`+.${d}`];
      })
    )
  ]);

const mergeRules = (baseRules = [], extraRules = []) => {
  const extra = Array.isArray(extraRules) ? extraRules.filter(Boolean) : [];
  if (!extra.length) return baseRules.slice();

  const matchIndex = baseRules.findIndex(
    (rule) => String(rule).trim().toUpperCase() === "MATCH,main"
  );

  if (matchIndex === -1) return uniq([...baseRules, ...extra]);

  return uniq([
    ...baseRules.slice(0, matchIndex),
    ...extra,
    ...baseRules.slice(matchIndex)
  ]);
};

const pickDirectRules = (rules = []) =>
  rules.filter((rule) => {
    const r = String(rule || "").trim();
    if (!r || r.startsWith("#")) return false;
    return /,DIRECT(?:,|$)/i.test(r);
  });

// ====================
// 3. 规则集与固定规则
// ====================

const RULE_PROVIDERS_DOMAINS = [
  "category-ads-all", "private", "google-cn", "synology", "microsoft@cn",
  "category-game-platforms-download@cn", "category-ai-!cn", "telegram", "gfw", "cn",
  "googlefcm", "google-gemini", "youtube", "google",
  "epicgames", "nvidia@cn", "cloudflare@cn", "steam@cn",
  "category-ntp", "connectivity-check", "apple", "spotify", "microsoft",
  "soundcloud"
];

const RULE_PROVIDERS_IPS = [
  "private", "cn"
];

const buildRuleProviders = () => {
  const providers = {};

  RULE_PROVIDERS_DOMAINS.forEach(name => {
    providers[name] = {
      type: "http",
      behavior: "domain",
      format: "mrs",
      path: `./rules/${name}.mrs`,
      url: `${SETTINGS.RULE_PROVIDER_URL_BASE}/geosite/${name}.mrs`,
      interval: 86400
    };
  });

  RULE_PROVIDERS_IPS.forEach(name => {
    providers[`${name}-ip`] = {
      type: "http",
      behavior: "ipcidr",
      format: "mrs",
      path: `./rules/${name}-ip.mrs`,
      url: `${SETTINGS.RULE_PROVIDER_URL_BASE}/geoip/${name}.mrs`,
      interval: 86400
    };
  });

  // Cloudflare 人机验证规则集
  providers.cloudflare = {
    type: "inline",
    behavior: "classical",
    payload: [
      "DOMAIN,challenges.cloudflare.com",
      "DOMAIN-SUFFIX,cloudflarechallenge.com"
    ]
  };

  return providers;
};

const STATIC_RULES = [
  "RULE-SET,category-ads-all,REJECT",

  // 自定义屏蔽
  ...uniq(CUSTOM_BLOCK_DOMAINS).map((d) => `DOMAIN-SUFFIX,${d},REJECT`),

  // Grok 访问 storage.googleapis.com 时强制拒绝
  "AND,((PROCESS-NAME,grok.exe),(DOMAIN-SUFFIX,storage.googleapis.com)),REJECT",

  ...uniq(BYPASS_DOMAINS).map((d) => `DOMAIN-SUFFIX,${d},DIRECT`),
  ...uniq(FORCE_PROXY_DOMAINS).map((d) => `DOMAIN,${d},main`),

  "RULE-SET,cloudflare,DIRECT",
  "RULE-SET,private,DIRECT",
  "RULE-SET,private-ip,DIRECT,no-resolve",
  "RULE-SET,googlefcm,fcm",
  "RULE-SET,google-cn,DIRECT",
  "RULE-SET,synology,DIRECT",
  "DOMAIN-SUFFIX,sharepoint.com,DIRECT",
  "RULE-SET,microsoft@cn,DIRECT",
  "RULE-SET,category-game-platforms-download@cn,DIRECT",
  "RULE-SET,category-ai-!cn,ai",
  "RULE-SET,google-gemini,ai",
  // Gemini 兜底：这些域名同时也在 google 规则集里，显式写死，
  // 即使规则集版本旧或类别不全，也不会掉进下面的 Google 组
  "DOMAIN-SUFFIX,gemini.google.com,ai",
  "DOMAIN-SUFFIX,aistudio.google.com,ai",
  "DOMAIN-SUFFIX,ai.google.dev,ai",
  "DOMAIN-SUFFIX,makersuite.google.com,ai",
  "DOMAIN-SUFFIX,bard.google.com,ai",
  "DOMAIN-SUFFIX,generativelanguage.googleapis.com,ai",
  "DOMAIN-SUFFIX,gemini.gstatic.com,ai",
  "DOMAIN-SUFFIX,aisandbox-pa.googleapis.com,ai",
  "DOMAIN-SUFFIX,cloudcode-pa.googleapis.com,ai",
  "DOMAIN-SUFFIX,alkalimakersuite-pa.clients6.google.com,ai",
  "DOMAIN-SUFFIX,geminiweb-pa.clients6.google.com,ai",
  "DOMAIN-SUFFIX,proactivebackend-pa.googleapis.com,ai",
  "DOMAIN-SUFFIX,notebooklm.google.com,ai",
  "RULE-SET,youtube,YouTube",
  "RULE-SET,google,Google",
  "RULE-SET,telegram,tg",
  "RULE-SET,soundcloud,sc",
  "RULE-SET,gfw,main",
  "RULE-SET,cn,DIRECT",
  "RULE-SET,cn-ip,DIRECT,no-resolve",
  "MATCH,main"
];

const STATIC_FAKE_IP_FILTER = buildFakeIpFilter(BYPASS_DOMAINS);

// ====================
// 4. 节点处理
// ====================

const ensureConfigObject = (input) =>
  input && typeof input === "object" ? input : {};

const getOriginalProxies = (input) =>
  Array.isArray(input.proxies) ? input.proxies : [];

const makeProxyNamesUnique = (proxies = []) => {
  const used = new Set();
  const nextIdx = new Map();

  proxies.forEach((p) => {
    if (!p || !p.name) return;

    const base = String(p.name);

    if (!used.has(base)) {
      used.add(base);
      nextIdx.set(base, 1);
      return;
    }

    let idx = nextIdx.get(base) ?? 1;
    let candidate = `${base}_${idx}`;

    while (used.has(candidate)) candidate = `${base}_${++idx}`;

    p.name = candidate;
    used.add(candidate);
    nextIdx.set(base, idx + 1);
  });
};

// 命中过滤规则的节点进入 excluded 分类，其余保留
const splitCustomProxies = (proxies = [], customFilter) => {
  const excludedProxies = [];
  const keptProxies = [];

  proxies.forEach((proxy) => {
    if (!proxy || !proxy.name) return;
    (customFilter.test(proxy.name) ? excludedProxies : keptProxies).push(proxy);
  });

  return { excludedProxies, keptProxies };
};

const splitInfoAndNormalProxies = (proxies = [], infoFilter) =>
  proxies.reduce(
    (acc, proxy) => {
      if (!proxy || !proxy.name) return acc;
      (infoFilter.test(proxy.name) ? acc.infoProxies : acc.normalProxies).push(proxy);
      return acc;
    },
    { infoProxies: [], normalProxies: [] }
  );

const classifyProxiesByRegion = (normalProxies = [], regions = []) => {
  const regionGroupsData = regions.map((r) => ({ name: r.name, icon: r.icon, proxies: [] }));
  const regionGroupMap = new Map(regionGroupsData.map((r) => [r.name, r]));
  const regionSeen = new Map(regionGroupsData.map((r) => [r.name, new Set()]));
  const otherProxyNames = [];
  const otherSeen = new Set();

  normalProxies.forEach((proxy) => {
    const proxyName = proxy.name;
    const normName = normalizeName(proxyName);
    const matchedRegion = regions.find((r) => r.regex.test(normName));

    if (matchedRegion) {
      const group = regionGroupMap.get(matchedRegion.name);
      const seen = regionSeen.get(matchedRegion.name);
      if (group && seen && !seen.has(proxyName)) {
        group.proxies.push(proxyName);
        seen.add(proxyName);
      }
    } else if (!otherSeen.has(proxyName)) {
      otherProxyNames.push(proxyName);
      otherSeen.add(proxyName);
    }
  });

  const activeRegions = regionGroupsData
    .map((r) => ({ ...r, proxies: uniq(r.proxies) }))
    .filter((r) => r.proxies.length > 0);

  const activeRegionNameSet = new Set(activeRegions.map((r) => r.name));
  const activeRegionMap = new Map(activeRegions.map((r) => [r.name, r]));

  return {
    activeRegions,
    activeRegionNameSet,
    activeRegionMap,
    otherProxyNames: uniq(otherProxyNames)
  };
};

const buildAllAiProxyList = (activeRegions = [], otherProxyNames = [], allNames = []) => {
  const nonHk = uniq([
    ...activeRegions.filter((r) => r.name !== "HK").flatMap((r) => r.proxies),
    ...otherProxyNames
  ]);
  return nonHk.length ? nonHk : allNames;
};

// ====================
// 5. 策略组
// ====================

const buildProxyGroups = ({
  allNames,
  allAiNames,
  activeRegionMap,
  activeRegionNameSet,
  otherProxyNames,
  infoNames,
  excludedNames
}) => {
  const groups = [];

  const add = (name, type, proxies, icon = "Available.png", extra = {}) => {
    proxies = uniq(proxies);
    if (name && proxies.length) {
      groups.push({
        name,
        type,
        proxies,
        icon: SETTINGS.ICON_BASE + icon,
        ...extra
      });
    }
  };

  const regionEntries = SETTINGS.REGION_ORDER.filter((rName) => activeRegionNameSet.has(rName));

 // main 组
  if (allNames.length) {
    const mainEntries = ["ALL", ...regionEntries];
    if (otherProxyNames.length) mainEntries.push("Other");
    add("main", "select", mainEntries, "Available.png");
  }

  // ai 组（包含地区子分组，排除 HK）
  if (allAiNames.length) {
    const aiRegionEntries = SETTINGS.REGION_ORDER.filter(
      (rName) => rName !== "HK" && activeRegionNameSet.has(rName)
    );
    const aiEntries = ["ALL-AI", ...aiRegionEntries];
    if (otherProxyNames.length) aiEntries.push("Other");
    add("ai", "select", aiEntries, "ChatGPT.png");
  }

  // ALL 组
  if (allNames.length) {
    add("URL Test - ALL", "url-test", allNames, "Auto.png", SETTINGS.URL_TEST_EXTRA);
    add("ALL", "select", ["URL Test - ALL", ...allNames], "Auto.png");
  }

  // ALL-AI 组（排除 HK 的所有节点）
  if (allAiNames.length) {
    add("URL Test - ALL-AI", "url-test", allAiNames, "ChatGPT.png", SETTINGS.URL_TEST_EXTRA);
    add("ALL-AI", "select", ["URL Test - ALL-AI", ...allAiNames], "ChatGPT.png");
  }

  // 地区分组
  SETTINGS.REGION_ORDER.forEach((rName) => {
    const region = activeRegionMap.get(rName);
    if (!region) return;

    add(`URL Test - ${region.name}`, "url-test", region.proxies, region.icon, SETTINGS.URL_TEST_EXTRA);
    add(region.name, "select", [`URL Test - ${region.name}`, ...region.proxies], region.icon);
  });

  // Other 组
  if (otherProxyNames.length) {
    add("URL Test - Other", "url-test", otherProxyNames, "Available.png", SETTINGS.URL_TEST_EXTRA);
    add("Other", "select", ["URL Test - Other", ...otherProxyNames], "Available.png");
  }

  // fcm 组：默认直连，可手动切到 HK / SG
  const fcmEntries = uniq(["DIRECT", ...regionEntries.filter((r) => r === "HK" || r === "SG")]);
  add("fcm", "select", fcmEntries, "Google_Search.png");

  // YouTube / Google 组：各自独立选节点（自动测速 + 地区子分组），互不影响
  if (allNames.length) {
    const mediaEntries = uniq([
      ...regionEntries,
      ...(otherProxyNames.length ? ["Other"] : [])
    ]);

    [
      { name: "YouTube", icon: "YouTube.png" },
      { name: "Google", icon: "Google.png" }
    ].forEach(({ name, icon }) => {
      add(`URL Test - ${name}`, "url-test", allNames, icon, SETTINGS.URL_TEST_EXTRA);
      add(name, "select", [`URL Test - ${name}`, ...mediaEntries], icon);
    });
  }

  // tg 组
  if (allNames.length) {
    const hasSG = activeRegionNameSet.has("SG");

    add("tg-fallback", "fallback", hasSG ? ["SG", "main"] : ["main"], "Telegram.png", {
      ...SETTINGS.FALLBACK_TEST_EXTRA,
      hidden: true
    });

    add("tg", "select", ["tg-fallback", ...(hasSG ? ["SG"] : []), "main"], "Telegram.png");
  }

  // sc 组（SoundCloud对节点纯净度要求高，默认经 ai）
  const scEntries = [
    ...(allAiNames.length ? ["ai"] : []),
    ...(allNames.length ? ["main"] : [])
  ];
  if (scEntries.length) {
    add("sc-fallback", "fallback", scEntries, "Music_Enhance.png", {
      ...SETTINGS.FALLBACK_TEST_EXTRA,
      hidden: true
    });

    // sc-fallback
    add("sc", "select", [...scEntries, "sc-fallback"], "Music_Enhance.png");
  }

  // info 组
  if (infoNames.length) {
    add("info", "select", infoNames, "Available.png");
  }

  // excluded 组：只读
  if (excludedNames.length) {
    add("excluded", "select", excludedNames, "Lock.png");
  }

  // GLOBAL 组
  add(
    "GLOBAL",
    "select",
    [
      ...(allNames.length ? ["main"] : []),
      ...(allAiNames.length ? ["ai"] : []),
      ...(allNames.length ? ["ALL"] : []),
      ...(allAiNames.length ? ["ALL-AI"] : []),
      ...regionEntries,
      ...(otherProxyNames.length ? ["Other"] : []),
      ...(allNames.length ? ["tg"] : []),
      ...(scEntries.length ? ["sc"] : []),
      ...(allNames.length ? ["YouTube", "Google"] : []),
      "fcm",
      ...(infoNames.length ? ["info"] : [])
    ],
    "Global.png"
  );

  return groups;
};

// ====================
// 6. 网络配置
// ====================

const removeGeoDataConfig = (cfg) => {
  delete cfg["geodata-mode"];
  delete cfg["geo-auto-update"];
  delete cfg["geo-update-interval"];
  delete cfg["geox-url"];
};

const applySniffer = (cfg) => {
  cfg.sniffer = {
    ...(cfg.sniffer || {}),
    enable: true,
    "force-dns-mapping": true,
    "parse-pure-ip": true,
    "override-destination": true,
    sniff: {
      HTTP: { ports: [80, "8080-8880"], "override-destination": true },
      TLS: { ports: [443, 8443] },
      QUIC: { ports: [443, 8443] }
    }
  };
};

const applyTun = (cfg) => {
  cfg.tun = {
    ...(cfg.tun || {}),
    enable: true,
    stack: "system",
    "auto-route": true,
    "auto-detect-interface": true,
    "strict-route": true,
    "dns-hijack": ["any:53", "tcp://any:53"]
  };
};

const applyDns = (cfg) => {
  const dns = cfg.dns || {};
  const fakeIpFilterFromCfg = Array.isArray(dns["fake-ip-filter"]) ? dns["fake-ip-filter"] : [];

  const chinaDNS = [
    "system",
    "https://dns.alidns.com/dns-query",
    "https://doh.pub/dns-query"
  ];

  const CustomDNS = [
    "https://edge.1molchuan.top/linuxdo",
    "https://edge.1molchuan.top/plus"
  ];

  const directRuleSetsForChinaDNS = [
    "rule-set:cn",
    "rule-set:google-cn",
    "rule-set:synology",
    "rule-set:googlefcm",
    "rule-set:epicgames",
    "rule-set:nvidia@cn",
    "rule-set:cloudflare@cn",
    "rule-set:steam@cn",
    "rule-set:category-game-platforms-download@cn",
    "rule-set:category-ntp",
    "rule-set:connectivity-check",
    "rule-set:apple",
    "rule-set:spotify",
    "rule-set:microsoft"
  ];

  const fullFakeIpFilter = uniq([
    "+.cn",
    "rule-set:cloudflare",
    "rule-set:private",

    ...directRuleSetsForChinaDNS,
    ...STATIC_FAKE_IP_FILTER,
    ...fakeIpFilterFromCfg
  ]);

  cfg.dns = {
    ...dns,
    enable: true,
    listen: "0.0.0.0:1053",
    ipv6: false,
    "cache-algorithm": "arc",
    "prefer-h3": false,
    "use-hosts": true,
    "use-system-hosts": true,
    "respect-rules": true,
    "enhanced-mode": "fake-ip",
    "fake-ip-filter-mode": "blacklist",
    "fake-ip-filter": fullFakeIpFilter,
    "default-nameserver": ["223.5.5.5", "119.29.29.29"],
    nameserver: CustomDNS,
    "proxy-server-nameserver": [
      "https://doh.pub/dns-query#DIRECT",
      "https://dns.alidns.com/dns-query#DIRECT"
    ],
    "direct-nameserver": chinaDNS
  };

  cfg.hosts = {
    "dns.alidns.com": ["223.5.5.5", "223.6.6.6"],
    "doh.pub": ["1.12.12.12", "120.53.53.53"],
    "services.googleapis.cn": ["services.googleapis.com"],
    "+.mcdn.bilivideo.com": ["0.0.0.0"],
    "+.mcdn.bilivideo.cn": ["0.0.0.0"]
  };
};

const applyProfile = (cfg) => {
  cfg.profile = {
    ...(cfg.profile || {}),
    "store-selected": true,
    "store-fake-ip": false
  };
};

const applyRuntime = (cfg) => {
  // 模式唯一权威是客户端的全局/规则开关，剥离订阅与上游配置自带的 mode
  delete cfg.mode;
  cfg["log-level"] = "warning";
};

// ====================
// 7. 主流程
// ====================

function main(config) {
  config = sanitizeConfig(ensureConfigObject(config));

  const originalProxies = getOriginalProxies(config);
  const existingRules = Array.isArray(config.rules) ? config.rules : [];

  config["rule-providers"] = {
    ...(config["rule-providers"] || {}),
    ...buildRuleProviders()
  };

  config.rules = mergeRules(STATIC_RULES, pickDirectRules(existingRules));

  if (originalProxies.length) {
    makeProxyNamesUnique(originalProxies);

    // 1. CUSTOM_FILTER 命中的节点进入 excluded 分类（excluded 优先于 info）
    const { excludedProxies, keptProxies } = splitCustomProxies(originalProxies, CUSTOM_FILTER);

    // 2. 用 INFO_FILTER 分离信息节点和普通节点
    const { infoProxies, normalProxies } = splitInfoAndNormalProxies(
      keptProxies,
      SETTINGS.INFO_FILTER
    );

    const baseProxies = normalProxies;
    const allNames = uniq(baseProxies.map((p) => p.name));
    const infoNames = uniq(infoProxies.map((p) => p.name));
    const excludedNames = uniq(excludedProxies.map((p) => p.name));

    const {
      activeRegions,
      activeRegionNameSet,
      activeRegionMap,
      otherProxyNames
    } = classifyProxiesByRegion(baseProxies, REGIONS);

    const allAiNames = buildAllAiProxyList(activeRegions, otherProxyNames, allNames);

    config["proxy-groups"] = buildProxyGroups({
      allNames,
      allAiNames,
      activeRegionMap,
      activeRegionNameSet,
      otherProxyNames,
      infoNames,
      excludedNames
    });

    // 保留所有原始节点
    config.proxies = originalProxies;
  } else {
    config["proxy-groups"] = buildProxyGroups({
      allNames: [],
      allAiNames: [],
      activeRegionMap: new Map(),
      activeRegionNameSet: new Set(),
      otherProxyNames: [],
      infoNames: [],
      excludedNames: []
    });
  }

  removeGeoDataConfig(config);
  applyRuntime(config);
  applySniffer(config);
  applyTun(config);
  applyDns(config);
  applyProfile(config);

  return config;
}
