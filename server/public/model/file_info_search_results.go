package model

type FileInfoSearchMatches map[string][]string

type FileInfoSearchResults struct {
	*FileInfoList
	Matches FileInfoSearchMatches `json:"matches"`
}

func MakeFileInfoSearchResults(fileInfos *FileInfoList, matches FileInfoSearchMatches) *FileInfoSearchResults {
	return &FileInfoSearchResults{
		fileInfos,
		matches,
	}
}
