type ProxyTreeNode = {
  all?: readonly string[]
}

export const collectProxyLeafNames = (
  proxyMap: Readonly<Record<string, ProxyTreeNode>>,
  rootGroups: readonly string[],
) => {
  const pending = [...rootGroups]
  const visitedGroups = new Set<string>()
  const leaves = new Set<string>()

  // Traverse nested selectors once so cycles cannot escape the selected device scope.
  // 每个嵌套选择器仅遍历一次，避免环路逃逸出所选设备作用域。
  while (pending.length) {
    const name = pending.shift()!
    if (visitedGroups.has(name)) continue
    visitedGroups.add(name)

    const members = proxyMap[name]?.all
    if (!members?.length) {
      leaves.add(name)
      continue
    }

    for (const member of members) {
      if (proxyMap[member]?.all?.length) pending.push(member)
      else leaves.add(member)
    }
  }

  return [...leaves]
}
