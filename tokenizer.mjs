import { makeCharList } from "./coreJs.mjs";
import { UNDEFINED }    from "./coreJs.mjs";
import { isArray }      from "./coreJs.mjs";
import { TRUE }         from "./coreJs.mjs";
import { isString }     from "./coreJs.mjs";

const applyTokenOnTokensMap = (token, tokensMap = {children:{}}) => {
    for (let i = 0; i < token.length; i++) {
        const char = token[i];
        if (!tokensMap.children[char]) {
            tokensMap.children[char] = {
                children: {},
            }
        }
        tokensMap = tokensMap.children[char];
    }
    return tokensMap;
}

export const TokenizerScheme = (scheme) => {
    const tokensEnum = {};
    const tokensKeywords = {};
    const tokensMapRoot = {
        keywords: tokensKeywords,
        enum: tokensEnum,
        children: {}
    };

    let tokenKindId = 0;
    for (let tokenIdName in scheme) {
        tokenKindId++;
        tokensEnum[tokenIdName] = tokenKindId;

        let tokenScheme = scheme[tokenIdName];
        if (!isArray(tokenScheme)) tokenScheme = [tokenScheme];

        tokenScheme.forEach(token => {
            if (isString(token)) {
                const currentMap = applyTokenOnTokensMap(token, tokensMapRoot);
                currentMap.tokenKindId = tokenKindId;
            } else if (token.exec) {
                token.tokens.forEach(subToken => {
                    const currentMap = applyTokenOnTokensMap(subToken, tokensMapRoot);
                    currentMap.execWithTokenKindId = tokenKindId;
                    currentMap.exec = token.exec    
                });
            } else if (token.fallback) {
                tokensMapRoot.fallbackWithTokenKindId = tokenKindId
                tokensMapRoot.fallback = token.fallback;
            } else if (token.tokens) {
                token.tokens.forEach(k => {
                    tokensKeywords[k] = tokenKindId;
                })
            } else if (!isArray(token)) {
                for (let char in token) {
                    const currentMap = applyTokenOnTokensMap(char, tokensMapRoot);
                    currentMap.tokenKindId = tokenKindId;    
                }
            }
        });
    }

    return tokensMapRoot;

}
export const TokenizeSync = (text, schemeMap, pos = 0, tokens = []) => {
    const { fallback } = schemeMap;
    let unknownStart = -1;
    let unknownEnd = -1;
    const pushUnknown = () => {
        if (unknownStart >= 0) {
            const start = unknownStart, end = unknownEnd + 1;
            const token = text.substring(start, end);
            tokens.push({
                kindId: schemeMap.keywords[token] || -1,
                token,
                start,
                end
            });
            unknownStart = -1;
        }
    }

    for (let i = pos; i < text.length; i++) {
        let confirmedPos = -1, confirmedTokenKindId, currentRoot = schemeMap;
        let endPositionAfterExec;
        let tokensAfterExec = [];
        for (let j = i; j < text.length; j++) {
            const char = text[j];
            if (!currentRoot.children[char]) {
                break;
            }
            currentRoot = currentRoot.children[char];

            if (currentRoot.exec) {
                endPositionAfterExec = currentRoot.exec(text, i, j + 1, currentRoot.execWithTokenKindId, currentRoot, tokensAfterExec)
                if (endPositionAfterExec !== UNDEFINED) {
                    confirmedPos = -1;
                    break;
                }
            }

            if (currentRoot.tokenKindId) {
                confirmedPos = j;
                confirmedTokenKindId = currentRoot.tokenKindId;
            }
        }


        if (confirmedPos >= 0) {
            pushUnknown();
            const start = i, end = confirmedPos + 1;
            tokens.push({
                kindId: confirmedTokenKindId,
                token: text.substring(start, end),
                start,
                end
            });

            i = confirmedPos;
        } else if (endPositionAfterExec !== UNDEFINED) {
            pushUnknown();

            tokens.push(...tokensAfterExec);
            i = endPositionAfterExec-1;
        } else {
            if (unknownStart < 0) {

                if (fallback) {
                    endPositionAfterExec = fallback(text, i, i, schemeMap.fallbackWithTokenKindId, currentRoot, tokensAfterExec)
                }

                if (endPositionAfterExec) {
                    tokensAfterExec.forEach(t => {
                        const keywordKindId = schemeMap.keywords[t.token];
                        if (keywordKindId) t.kindId = keywordKindId;
                    });
                    
                    tokens.push(...tokensAfterExec);
                    i = endPositionAfterExec - 1;
                } else {
                    unknownStart = unknownEnd = i;
                }
            } else {
                unknownEnd = i;
            }
        }

    }

    pushUnknown();

    return tokens
}
export const tokenizerExec = (...tokensAndFunction) => {
    const tokens = [];
    const exec = tokensAndFunction.pop();

    tokensAndFunction.forEach(t => {
        if (isString(t)) {
            tokens.push(t)
        } else {
            for (let char in t) {
                tokens.push(char);
            }
        }
    })

    return {
        tokens,
        exec
    }
}
export const tokenizerKey = (...tokens) => {
    return {
        tokens,
    }
}

export const tokenizerFallback = (fallback) => {
    return {
        fallback,
    }
}

export const getTokenText = (text, start, end) => 
    text.substring(start.start, end ? end.end : start.end);
