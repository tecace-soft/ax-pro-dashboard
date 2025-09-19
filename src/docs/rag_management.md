# RAG Management -- v1 Frontend Contract (PoC)

## 목표 (이번 스프린트)

-   **문서 리스트 보기 (list_docs)**: 인덱스에 올라간 문서/청크 목록을
    테이블로 보여주기
-   페이징은 우선 `top`만 지원 (skip은 차후)
-   이후 단계에서: blob 업로드/삭제, 재인덱싱, 검색(search_docs v2)
    순으로 확장

------------------------------------------------------------------------

## 공통

-   엔드포인트: PromptFlow v1 실행 엔드포인트 (Internal)

-   요청 형식: JSON single payload `{ op, ... }`

-   응답 공통 래퍼:

    ``` json
    {
      "ok": true,
      "route": "list_docs",
      "data": { ... },       // 실제 Azure AI Search 응답 (원형 유지)
      "meta": { "version": "v1" }
    }
    ```

-   에러시:

    ``` json
    {
      "ok": false,
      "route": "list_docs",
      "error": { "code": "unsupported_route", "message": "..." },
      "meta": { "version": "v1" }
    }
    ```

------------------------------------------------------------------------

## 1) 문서 리스트 (list_docs)

### Request (payload)

``` json
{
  "op": "list_docs",
  "top": 20,                          // optional, default 10
  "select": "chunk_id,parent_id,title,filepath",   // optional, 인덱스에 존재하는 필드만
  "prefix": ""                        // optional, 예약 (현재 미사용)
}
```

> `select`는 인덱스 실제 필드만 넣어야 함. 기본 추천:
> `"chunk_id,parent_id,title,url,filepath,content"`

### Response (성공)

Azure AI Search의 문서 나열 결과를 **원형**으로 반환:

``` json
{
  "ok": true,
  "route": "list_docs",
  "data": {
    "@odata.context": "...",
    "@odata.count": 132,
    "value": [
      {
        "chunk_id": "pf-demo-001-0001",
        "parent_id": "pf-demo-001",
        "title": "Leave Policy Handbook",
        "filepath": "hr/leave/handbook.pdf",
        "url": "https://.../handbook.pdf"
        // 선택한 select 에 따라 필드 구성
      }
    ]
  },
  "meta": { "version": "v1" }
}
```

### UI 표시 가이드

-   컬럼: `title`, `filepath`(또는 `url`), `parent_id`, `chunk_id`
-   행 클릭 → (차후) 상세, 삭제/재인덱싱 액션 패널 오픈
-   상단 우측: `top` 셀렉트(10/20/50/100)

### 샘플 호출 (curl)

``` bash
curl -X POST $PF_RUN_ENDPOINT   -H "Content-Type: application/json"   -d '{"payload":{"op":"list_docs","top":20,"select":"chunk_id,parent_id,title,filepath"}}'
```

------------------------------------------------------------------------

## 2) 검색 (search_docs) -- **v1에서는 라우트 미지원**

-   현재 v1 라우터에서 `search_docs`는 **unsupported_route**
-   v2로 승격 시 아래 계약 예정:
    -   payload:
        `{ "op": "search", "q": "leave policy", "top": 5, "filters": "...", "select": "..." }`
    -   응답: Azure Search `/docs/search` 원형 + wrapper

------------------------------------------------------------------------

## 3) 예정 기능(후속)

-   Blob: `blob_upload`, `blob_delete`, `blob_list`, `blob_download`,
    `blob_replace`
-   인덱스 유틸: `reindex_blob`, `clear_by_parent`
-   Batch: `upsert_batch`
-   Doc CRUD: `read`, `upsert`, `delete`
