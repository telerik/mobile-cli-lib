#include <Windows.h>
#include <WinCred.h>
#include <string>
#include <iostream>

using namespace std;
int wmain(int argc, wchar_t *argv[])
{
	if (argc < 2)
	{
		// No command specified
		return ERROR_INVALID_COMMAND_LINE;
	}

	if (wcscmp(argv[1], L"get") == 0) {
		PCREDENTIALW p;
		if (!CredRead(argv[2], 1, 0, &p))
		{
			return GetLastError();
		}

		wstring pass((wchar_t*)p->CredentialBlob);
		wcout << p->UserName << endl << pass << endl;
		CredFree(p);
	}
	else if (wcscmp(argv[1], L"set") == 0) {
		CREDENTIALW credsToAdd = {};
		credsToAdd.Flags = 0;
		credsToAdd.Type = CRED_TYPE_GENERIC;
		credsToAdd.TargetName = argv[2];
		credsToAdd.UserName = argv[3];
		credsToAdd.CredentialBlob = (LPBYTE)argv[4];
		credsToAdd.CredentialBlobSize = (wcslen(argv[4])+1)*sizeof(*argv[4]);
		credsToAdd.Persist = CRED_PERSIST_ENTERPRISE;
		if (!CredWrite(&credsToAdd, 0))
		{
			return GetLastError();
		}
	}
	else if (wcscmp(argv[1], L"clear") == 0) {
		if (!CredDelete(argv[2], 1, 0))
		{
			DWORD lastError = GetLastError();

			if (lastError != ERROR_NOT_FOUND)
			{
				return lastError;
			}
		}
	}

	return 0;
}
