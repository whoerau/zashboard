// Keep the shared snapshot empty because sing-box exposes no rule list.
// sing-box 不提供规则列表，因此共享快照保持为空。
export const fetchRules = async () => ({ rules: [], ruleProviderList: [] })
