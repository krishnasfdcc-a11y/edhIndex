import { LanguageAdapter, ParseResult, CodeSymbol, SymbolType } from '../types.js';

export class SalesforceAdapter implements LanguageAdapter {
  languageName(): string { return 'Salesforce'; }
  fileExtensions(): string[] { 
    return [
      '.cls', '.trigger', '.page', '.component', '.cmp', '.app', '.evt', '.intf',
      '.design', '.auradoc', '.js-meta.xml', '.object-meta.xml', '.field-meta.xml',
      '.permissionset-meta.xml', '.profile-meta.xml', '.layout-meta.xml',
      '.flexipage-meta.xml', '.flow-meta.xml', '.workflow-meta.xml',
      '.approvalProcess-meta.xml', '.quickAction-meta.xml', '.labels-meta.xml',
      '.globalValueSet-meta.xml', '.remoteSite-meta.xml', '.connectedApp-meta.xml',
      '.customMetadata-meta.xml', '.customApplication-meta.xml', '.tabs-meta.xml',
      '.sharingRules-meta.xml', '.queue-meta.xml', '.role-meta.xml',
      '.group-meta.xml', '.email-meta.xml', '.reportType-meta.xml',
      '.dashboard-meta.xml', '.report-meta.xml',
    ]; 
  }
  fileNames(): string[] { return []; }
  canParse(filePath: string): boolean {
    const lower = filePath.toLowerCase();
    for (const ext of this.fileExtensions()) {
      if (lower.endsWith(ext)) return true;
    }
    return false;
  }
  supportsSymbols(): boolean { return true; }

  async parse(content: string, filePath: string): Promise<ParseResult> {
    const lines = content.split('\n');
    const symbols: CodeSymbol[] = [];
    const imports: string[] = [];
    const exports: string[] = [];
    const comments: string[] = [];

    if (filePath.endsWith('.cls') || filePath.endsWith('.trigger')) {
      this.extractApexCode(lines, symbols, filePath);
    } else if (filePath.endsWith('.page') || filePath.endsWith('.component')) {
      this.extractVisualforce(lines, symbols, filePath);
    } else if (filePath.endsWith('.cmp') || filePath.endsWith('.app') || filePath.endsWith('.evt') || filePath.endsWith('.intf')) {
      this.extractAura(lines, symbols, filePath);
    } else {
      this.extractMetadata(lines, symbols, filePath);
    }

    this.extractComments(lines, comments);

    return { symbols, imports, exports, comments };
  }

  private extractApexCode(lines: string[], symbols: CodeSymbol[], filePath: string) {
    const patterns = [
      { regex: /^public\s+(?:with\s+sharing\s+|without\s+sharing\s+)?class\s+(\w+)/gi, type: SymbolType.Class },
      { regex: /^private\s+(?:with\s+sharing\s+|without\s+sharing\s+)?class\s+(\w+)/gi, type: SymbolType.Class },
      { regex: /^global\s+(?:with\s+sharing\s+|without\s+sharing\s+)?class\s+(\w+)/gi, type: SymbolType.Class },
      { regex: /^public\s+interface\s+(\w+)/gi, type: SymbolType.Interface },
      { regex: /^public\s+enum\s+(\w+)/gi, type: SymbolType.Enum },
      { regex: /^public\s+(?:static\s+)?(?:void|integer|string|boolean|list|map|set)\s+(\w+)\s*\(/gi, type: SymbolType.Function },
      { regex: /^private\s+(?:static\s+)?(?:void|integer|string|boolean|list|map|set)\s+(\w+)\s*\(/gi, type: SymbolType.Function },
      { regex: /^public\s+trigger\s+(\w+)\s+on\s+(\w+)/gi, type: SymbolType.Function },
      { regex: /^trigger\s+(\w+)\s+on\s+(\w+)/gi, type: SymbolType.Function },
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      for (const pattern of patterns) {
        pattern.regex.lastIndex = 0;
        const match = pattern.regex.exec(line);
        if (match) {
          symbols.push({
            id: `${filePath}:${i + 1}`,
            name: match[1],
            type: pattern.type,
            language: 'salesforce',
            file: filePath,
            startLine: i + 1,
            endLine: i + 1,
            parent: null,
            children: [],
            metadata: {},
          });
        }
      }
    }
  }

  private extractVisualforce(lines: string[], symbols: CodeSymbol[], filePath: string) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Extract apex:page, apex:form, apex:inputField, etc.
      const tagMatch = line.match(/<apex:(\w+)/i);
      if (tagMatch) {
        symbols.push({
          id: `${filePath}:${i + 1}`,
          name: tagMatch[1],
          type: SymbolType.Class,
          language: 'salesforce',
          file: filePath,
          startLine: i + 1,
          endLine: i + 1,
          parent: null,
          children: [],
          metadata: {},
        });
      }
    }
  }

  private extractAura(lines: string[], symbols: CodeSymbol[], filePath: string) {
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Extract aura:component, aura:attribute, aura:handler, etc.
      const tagMatch = line.match(/<aura:(\w+)/i);
      if (tagMatch) {
        symbols.push({
          id: `${filePath}:${i + 1}`,
          name: tagMatch[1],
          type: SymbolType.Class,
          language: 'salesforce',
          file: filePath,
          startLine: i + 1,
          endLine: i + 1,
          parent: null,
          children: [],
          metadata: {},
        });
      }
      
      // Extract LWC components
      const lwcMatch = line.match(/<(\w+-\w+)/i);
      if (lwcMatch) {
        symbols.push({
          id: `${filePath}:${i + 1}`,
          name: lwcMatch[1],
          type: SymbolType.Class,
          language: 'salesforce',
          file: filePath,
          startLine: i + 1,
          endLine: i + 1,
          parent: null,
          children: [],
          metadata: {},
        });
      }
    }
  }

  private extractMetadata(lines: string[], symbols: CodeSymbol[], filePath: string) {
    // For XML-based metadata files, extract root element and key attributes
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      
      // Extract root XML element
      const rootMatch = line.match(/<(\w+)[\s>]/);
      if (rootMatch && i < 5) {
        symbols.push({
          id: `${filePath}:${i + 1}`,
          name: rootMatch[1],
          type: SymbolType.Module,
          language: 'salesforce',
          file: filePath,
          startLine: i + 1,
          endLine: i + 1,
          parent: null,
          children: [],
          metadata: {},
        });
      }
      
      // Extract key elements
      const elementMatch = line.match(/<(\w+)>(.+?)<\/\1>/);
      if (elementMatch) {
        symbols.push({
          id: `${filePath}:${i + 1}`,
          name: elementMatch[1],
          type: SymbolType.Property,
          language: 'salesforce',
          file: filePath,
          startLine: i + 1,
          endLine: i + 1,
          parent: null,
          children: [],
          metadata: { value: elementMatch[2] },
        });
      }
    }
  }

  private extractComments(lines: string[], comments: string[]) {
    let inBlockComment = false;
    let blockComment = '';

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Apex/Java style comments
      if (inBlockComment) {
        const endIdx = line.indexOf('*/');
        if (endIdx >= 0) {
          blockComment += line.substring(0, endIdx + 2);
          comments.push(blockComment.trim());
          blockComment = '';
          inBlockComment = false;
        } else {
          blockComment += line + '\n';
        }
      } else {
        const startIdx = line.indexOf('/*');
        if (startIdx >= 0) {
          const endIdx = line.indexOf('*/', startIdx + 2);
          if (endIdx >= 0) {
            comments.push(line.substring(startIdx, endIdx + 2).trim());
          } else {
            blockComment = line.substring(startIdx) + '\n';
            inBlockComment = true;
          }
        }
        
        if (trimmed.startsWith('//')) {
          comments.push(trimmed);
        }
        
        // XML comments
        if (trimmed.startsWith('<!--')) {
          const endIdx = line.indexOf('-->');
          if (endIdx >= 0) {
            comments.push(line.substring(0, endIdx + 3).trim());
          }
        }
      }
    }
  }
}
