import { memo, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { FileMap } from '~/lib/stores/files';
import { classNames } from '~/utils/classNames';
import { createScopedLogger, renderLogger } from '~/utils/logger';

const logger = createScopedLogger('FileTree');

const NODE_PADDING_LEFT = 8;
const DEFAULT_HIDDEN_FILES = [/\/node_modules\//, /\/\.next/, /\/\.astro/];

interface Props {
  files?: FileMap;
  selectedFile?: string;
  onFileSelect?: (filePath: string) => void;
  rootFolder?: string;
  hideRoot?: boolean;
  collapsed?: boolean;
  allowFolderSelection?: boolean;
  hiddenFiles?: Array<string | RegExp>;
  unsavedFiles?: Set<string>;
  className?: string;
}

export const FileTree = memo(
  ({
    files = {},
    onFileSelect,
    selectedFile,
    rootFolder,
    hideRoot = false,
    collapsed = false,
    allowFolderSelection = false,
    hiddenFiles,
    className,
    unsavedFiles,
  }: Props) => {
    renderLogger.trace('FileTree');

    const computedHiddenFiles = useMemo(() => [...DEFAULT_HIDDEN_FILES, ...(hiddenFiles ?? [])], [hiddenFiles]);

    const fileList = useMemo(() => {
      return buildFileList(files, rootFolder, hideRoot, computedHiddenFiles);
    }, [files, rootFolder, hideRoot, computedHiddenFiles]);

    const [collapsedFolders, setCollapsedFolders] = useState(() => {
      return collapsed
        ? new Set(fileList.filter((item) => item.kind === 'folder').map((item) => item.fullPath))
        : new Set<string>();
    });

    useEffect(() => {
      if (collapsed) {
        setCollapsedFolders(new Set(fileList.filter((item) => item.kind === 'folder').map((item) => item.fullPath)));
        return;
      }

      setCollapsedFolders((prevCollapsed) => {
        const newCollapsed = new Set<string>();

        for (const folder of fileList) {
          if (folder.kind === 'folder' && prevCollapsed.has(folder.fullPath)) {
            newCollapsed.add(folder.fullPath);
          }
        }

        return newCollapsed;
      });
    }, [fileList, collapsed]);

    const filteredFileList = useMemo(() => {
      const list = [];

      let lastDepth = Number.MAX_SAFE_INTEGER;

      for (const fileOrFolder of fileList) {
        const depth = fileOrFolder.depth;

        // if the depth is equal we reached the end of the collaped group
        if (lastDepth === depth) {
          lastDepth = Number.MAX_SAFE_INTEGER;
        }

        // ignore collapsed folders
        if (collapsedFolders.has(fileOrFolder.fullPath)) {
          lastDepth = Math.min(lastDepth, depth);
        }

        // ignore files and folders below the last collapsed folder
        if (lastDepth < depth) {
          continue;
        }

        list.push(fileOrFolder);
      }

      return list;
    }, [fileList, collapsedFolders]);

    const toggleCollapseState = (fullPath: string) => {
      setCollapsedFolders((prevSet) => {
        const newSet = new Set(prevSet);

        if (newSet.has(fullPath)) {
          newSet.delete(fullPath);
        } else {
          newSet.add(fullPath);
        }

        return newSet;
      });
    };

    return (
      <div className={classNames('text-sm', className)}>
        {filteredFileList.map((fileOrFolder) => {
          switch (fileOrFolder.kind) {
            case 'file': {
              return (
                <File
                  key={fileOrFolder.id}
                  selected={selectedFile === fileOrFolder.fullPath}
                  file={fileOrFolder}
                  unsavedChanges={unsavedFiles?.has(fileOrFolder.fullPath)}
                  onClick={() => {
                    onFileSelect?.(fileOrFolder.fullPath);
                  }}
                />
              );
            }
            case 'folder': {
              return (
                <Folder
                  key={fileOrFolder.id}
                  folder={fileOrFolder}
                  selected={allowFolderSelection && selectedFile === fileOrFolder.fullPath}
                  collapsed={collapsedFolders.has(fileOrFolder.fullPath)}
                  onClick={() => {
                    toggleCollapseState(fileOrFolder.fullPath);
                  }}
                />
              );
            }
            default: {
              return undefined;
            }
          }
        })}
      </div>
    );
  },
);

export default FileTree;

interface FolderProps {
  folder: FolderNode;
  collapsed: boolean;
  selected?: boolean;
  onClick: () => void;
}

function Folder({ folder: { depth, name }, collapsed, selected = false, onClick }: FolderProps) {
  const folderIcon = getFileIcon(name, true, !collapsed);
  return (
    <NodeButton
      className={classNames('group', {
        'bg-transparent text-bolt-elements-item-contentDefault hover:text-bolt-elements-item-contentActive hover:bg-bolt-elements-item-backgroundActive':
          !selected,
        'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': selected,
      })}
      depth={depth}
      iconClasses={folderIcon}
      onClick={onClick}
    >
      {name}
    </NodeButton>
  );
}

interface FileProps {
  file: FileNode;
  selected: boolean;
  unsavedChanges?: boolean;
  onClick: () => void;
}

function File({ file: { depth, name }, onClick, selected, unsavedChanges = false }: FileProps) {
  const fileIcon = getFileIcon(name, false);
  return (
    <NodeButton
      className={classNames('group', {
        'bg-transparent hover:bg-bolt-elements-item-backgroundActive text-bolt-elements-item-contentDefault': !selected,
        'bg-bolt-elements-item-backgroundAccent text-bolt-elements-item-contentAccent': selected,
      })}
      depth={depth}
      iconClasses={fileIcon}
      onClick={onClick}
    >
      <div
        className={classNames('flex items-center', {
          'group-hover:text-bolt-elements-item-contentActive': !selected,
        })}
      >
        <div className="flex-1 truncate pr-2">{name}</div>
        {unsavedChanges && <span className="i-ph:circle-fill scale-68 shrink-0 text-orange-500" />}
      </div>
    </NodeButton>
  );
}

function getFileIcon(fileName: string, isFolder: boolean, isFolderOpen?: boolean): string {
  if (isFolder) {
    const folderName = fileName.toLowerCase();
    const icon = isFolderOpen ? 'i-mdi:folder-open' : 'i-mdi:folder';
    let color = 'text-yellow-500';
    
    switch (folderName) {
      case 'src':
        color = 'text-blue-500';
        break;
      case 'components':
        color = 'text-green-500';
        break;
      case 'pages':
        color = 'text-purple-500';
        break;
      case 'assets':
        color = 'text-yellow-500';
        break;
      case 'styles':
      case 'css':
        color = 'text-pink-500';
        break;
      case 'js':
      case 'javascript':
        color = 'text-yellow-400';
        break;
      case 'ts':
      case 'typescript':
        color = 'text-blue-600';
        break;
      case 'test':
      case 'tests':
      case '__tests__':
        color = 'text-red-500';
        break;
      case 'public':
        color = 'text-green-600';
        break;
      case 'docs':
      case 'documentation':
        color = 'text-blue-400';
        break;
      case 'node_modules':
        color = 'text-gray-500';
        break;
      case 'build':
      case 'dist':
        color = 'text-orange-500';
        break;
    }

    return `${icon} ${color}`;
  }

  // The rest of the function for file icons remains the same
  const extension = fileName.split('.').pop()?.toLowerCase();
  switch (extension) {
    // JavaScript and TypeScript
    case 'js':
      return 'i-mdi:language-javascript text-yellow-400';
    case 'jsx':
      return 'i-mdi:react text-blue-400';
    case 'ts':
      return 'i-mdi:language-typescript text-blue-600';
    case 'tsx':
      return 'i-mdi:react text-blue-500';
    
    // Styling
    case 'css':
      return 'i-mdi:language-css3 text-blue-500';
    case 'scss':
    case 'sass':
      return 'i-mdi:sass text-pink-400';
    case 'less':
      return 'i-mdi:language-css3 text-indigo-400';
    
    // Markup and Documentation
    case 'html':
      return 'i-mdi:language-html5 text-orange-500';
    case 'md':
    case 'markdown':
      return 'i-mdi:language-markdown text-blue-300';
    case 'svg':
      return 'i-mdi:svg text-orange-400';
    
    // Data formats
    case 'json':
      return 'i-mdi:code-json text-yellow-300';
    case 'yaml':
    case 'yml':
      return 'i-mdi:file-code-outline text-purple-400';
    
    // Server-side languages
    case 'php':
      return 'i-mdi:language-php text-indigo-400';
    case 'py':
      return 'i-mdi:language-python text-blue-500';
    case 'rb':
      return 'i-mdi:language-ruby text-red-500';
    
    // Build and package management
    case 'webpack.config.js':
      return 'i-mdi:webpack text-blue-300';
    case 'package.json':
      return 'i-mdi:nodejs text-green-600';
    case 'yarn.lock':
      return 'i-mdi:package-variant-closed text-blue-400';
    
    // Configuration files
    case 'env':
      return 'i-mdi:file-cog-outline text-yellow-600';
    case 'gitignore':
      return 'i-mdi:git text-orange-600';
    case 'eslintrc':
    case 'eslintignore':
      return 'i-mdi:eslint text-purple-500';
    case 'prettierrc':
      return 'i-mdi:code-tags-check text-green-400';
    
    // Images
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
      return 'i-mdi:file-image-outline text-purple-400';
    
    // Fonts
    case 'ttf':
    case 'otf':
    case 'woff':
    case 'woff2':
      return 'i-mdi:font-awesome text-red-300';
    
    // Default
    default:
      return 'i-mdi:file-outline text-gray-400';
  }
}

interface ButtonProps {
  depth: number;
  iconClasses: string;
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

function NodeButton({ depth, iconClasses, onClick, className, children }: ButtonProps) {
  return (
    <button
      className={classNames(
        'flex items-center gap-1.5 w-full pr-2 border-2 border-transparent text-faded py-0.5',
        className,
      )}
      style={{ paddingLeft: `${6 + depth * NODE_PADDING_LEFT}px` }}
      onClick={() => onClick?.()}
    >
      <div className={classNames('scale-120 shrink-0', iconClasses)}></div>
      <div className="truncate w-full text-left">{children}</div>
    </button>
  );
}

type Node = FileNode | FolderNode;

interface BaseNode {
  id: number;
  depth: number;
  name: string;
  fullPath: string;
}

interface FileNode extends BaseNode {
  kind: 'file';
}

interface FolderNode extends BaseNode {
  kind: 'folder';
}

function buildFileList(
  files: FileMap,
  rootFolder = '/',
  hideRoot: boolean,
  hiddenFiles: Array<string | RegExp>,
): Node[] {
  const folderPaths = new Set<string>();
  const fileList: Node[] = [];

  let defaultDepth = 0;

  if (rootFolder === '/' && !hideRoot) {
    defaultDepth = 1;
    fileList.push({ kind: 'folder', name: '/', depth: 0, id: 0, fullPath: '/' });
  }

  for (const [filePath, dirent] of Object.entries(files)) {
    const segments = filePath.split('/').filter((segment) => segment);
    const fileName = segments.at(-1);

    if (!fileName || isHiddenFile(filePath, fileName, hiddenFiles)) {
      continue;
    }

    let currentPath = '';

    let i = 0;
    let depth = 0;

    while (i < segments.length) {
      const name = segments[i];
      const fullPath = (currentPath += `/${name}`);

      if (!fullPath.startsWith(rootFolder) || (hideRoot && fullPath === rootFolder)) {
        i++;
        continue;
      }

      if (i === segments.length - 1 && dirent?.type === 'file') {
        fileList.push({
          kind: 'file',
          id: fileList.length,
          name,
          fullPath,
          depth: depth + defaultDepth,
        });
      } else if (!folderPaths.has(fullPath)) {
        folderPaths.add(fullPath);

        fileList.push({
          kind: 'folder',
          id: fileList.length,
          name,
          fullPath,
          depth: depth + defaultDepth,
        });
      }

      i++;
      depth++;
    }
  }

  return sortFileList(rootFolder, fileList, hideRoot);
}

function isHiddenFile(filePath: string, fileName: string, hiddenFiles: Array<string | RegExp>) {
  return hiddenFiles.some((pathOrRegex) => {
    if (typeof pathOrRegex === 'string') {
      return fileName === pathOrRegex;
    }

    return pathOrRegex.test(filePath);
  });
}

/**
 * Sorts the given list of nodes into a tree structure (still a flat list).
 *
 * This function organizes the nodes into a hierarchical structure based on their paths,
 * with folders appearing before files and all items sorted alphabetically within their level.
 *
 * @note This function mutates the given `nodeList` array for performance reasons.
 *
 * @param rootFolder - The path of the root folder to start the sorting from.
 * @param nodeList - The list of nodes to be sorted.
 *
 * @returns A new array of nodes sorted in depth-first order.
 */
function sortFileList(rootFolder: string, nodeList: Node[], hideRoot: boolean): Node[] {
  logger.trace('sortFileList');

  const nodeMap = new Map<string, Node>();
  const childrenMap = new Map<string, Node[]>();

  // pre-sort nodes by name and type
  nodeList.sort((a, b) => compareNodes(a, b));

  for (const node of nodeList) {
    nodeMap.set(node.fullPath, node);

    const parentPath = node.fullPath.slice(0, node.fullPath.lastIndexOf('/'));

    if (parentPath !== rootFolder.slice(0, rootFolder.lastIndexOf('/'))) {
      if (!childrenMap.has(parentPath)) {
        childrenMap.set(parentPath, []);
      }

      childrenMap.get(parentPath)?.push(node);
    }
  }

  const sortedList: Node[] = [];

  const depthFirstTraversal = (path: string): void => {
    const node = nodeMap.get(path);

    if (node) {
      sortedList.push(node);
    }

    const children = childrenMap.get(path);

    if (children) {
      for (const child of children) {
        if (child.kind === 'folder') {
          depthFirstTraversal(child.fullPath);
        } else {
          sortedList.push(child);
        }
      }
    }
  };

  if (hideRoot) {
    // if root is hidden, start traversal from its immediate children
    const rootChildren = childrenMap.get(rootFolder) || [];

    for (const child of rootChildren) {
      depthFirstTraversal(child.fullPath);
    }
  } else {
    depthFirstTraversal(rootFolder);
  }

  return sortedList;
}

function compareNodes(a: Node, b: Node): number {
  if (a.kind !== b.kind) {
    return a.kind === 'folder' ? -1 : 1;
  }

  return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
}

