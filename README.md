# simulation-frontend

## User-Interactions 
We suggest having a user-json looking sth like this: 
```
{
  "user_key": <String>, 
  "bloc": {
    "name": <String> 
    "write": <bool> // if true, can create and modify `Bases`
  }, 
  "zone": {
    "name": <String> 
    "write": <bool> // if true, can create and modify `Trusts`
  }
}
```
The `user_key` should be part of all request headers.

#### Creating Trusts
When selecting a `Placement`, if a user has "write" access for the `Zone` the placement is associated with, the user can: 
- suggest "financiers" who help finance the expenses for the `Trust` to a certain percentage (=> input fields: financier key (text), percentage (number))
- multiple financiers possible
- => create the `Trust`

API:
- `POST /api/trusts` (payload: `{placementId: <placement_id>,  payment: {financierId: <financier_id (str)>, percentage: <value (int)>}`)

#### Creating Bases 
When selecting a `Placement`, if a user has "write" access for the `Bloc` the placement is associated with, the user can: 
- suggest "financiers" who help finance the expenses for the `Base` to a certain percentage (=> input fields: financier key (text), percentage (number))
- multiple financiers possible
- => create the `Base`

API: 
- `POST /api/bases` (payload: `{placementId: <placement_id>,  payment: {financierId: <financier_id (str)>, percentage: <value (int)>}`)

#### Updating Bases
When selecting a `Base`, if a user has "write" access for the `Bloc` the base is associated with, the user can: 
- activate/deactivate the base (checkbox)
- prioritise the `Base` (checkbox)
  
API: 
- `PATCH /api/bases/{id}` Payload: `{(optional) prioritized: <true|false>, (optional) target: <trust|base>}`

#### Changing Laws (Enhancement)
When selecting a `Zone`, if a user has "write" access for the `Zone`, the user can: 
- select from a list of "social laws" and implement/ or withdraw them
