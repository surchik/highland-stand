/*
 * A stand-in for pg-safeupdate (https://github.com/eradman/pg-safeupdate), which the shared Supabase loads for the
 * API's sessions: an UPDATE or a DELETE without a WHERE clause is refused, wherever it comes from (a function's
 * body included). Written for the tests only (tools/platform/safeupdate/build.sh); it is never installed on a server.
 * What it refuses, its messages and its error code (21000) follow the original's; its switch is safeupdate.enabled
 * (on by default), as there.
 */
#include "postgres.h"
#include "fmgr.h"
#include "parser/analyze.h"
#include "nodes/parsenodes.h"
#include "utils/guc.h"

PG_MODULE_MAGIC;

void _PG_init(void);

static post_parse_analyze_hook_type prev_hook = NULL;
static bool safeupdate_enabled = true;

static void
safeupdate_check(ParseState *pstate, Query *query, JumbleState *jstate)
{
	if (safeupdate_enabled && query->jointree != NULL && query->jointree->quals == NULL)
	{
		if (query->commandType == CMD_UPDATE)
			ereport(ERROR, (errcode(ERRCODE_CARDINALITY_VIOLATION), errmsg("UPDATE requires a WHERE clause")));
		if (query->commandType == CMD_DELETE)
			ereport(ERROR, (errcode(ERRCODE_CARDINALITY_VIOLATION), errmsg("DELETE requires a WHERE clause")));
	}
	if (prev_hook)
		prev_hook(pstate, query, jstate);
}

void
_PG_init(void)
{
	DefineCustomBoolVariable("safeupdate.enabled", "Enforce qualified updates", "Refuse UPDATE and DELETE without a WHERE clause",
							 &safeupdate_enabled, true, PGC_SUSET, 0, NULL, NULL, NULL);
	prev_hook = post_parse_analyze_hook;
	post_parse_analyze_hook = safeupdate_check;
}
