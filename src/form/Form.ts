import { Either, right } from '@sweet-monads/either';

type FailedMessage = {
	message: string;
};

type ValueValidator<R> = (value: R) => Either<FailedMessage, R>;

// Tipo para paths de string (ej: "user.name")
type PathValueTypeString<
	T,
	S extends string
> = S extends `${infer K}.${infer Rest}`
	? K extends keyof T
		? PathValueTypeString<ExtractFieldType<T[K]>, Rest>
		: never
	: S extends keyof T
	? ExtractFieldValue<T[S]>
	: never;

// Extrae el tipo del valor de un FormField o FormFieldGroup
type ExtractFieldValue<F> = F extends FormField<infer R>
	? R
	: F extends FormFieldGroup<infer G>
	? ExtractGroupValues<G>
	: never;

// Extrae el tipo de estructura de un FormField o FormFieldGroup para navegación
type ExtractFieldType<F> = F extends FormField<infer R>
	? R
	: F extends FormFieldGroup<infer G>
	? G
	: never;

// Extrae los valores de un FormFieldGroup
type ExtractGroupValues<
	T extends Record<string, FormField<unknown> | FormFieldGroup<any>>
> = {
	[K in keyof T]: ExtractFieldValue<T[K]>;
};

class FormField<R> {
	private validators: ValueValidator<R>[];

	constructor(
		private value: R,
		validators: ValueValidator<R>[] | ValueValidator<R> = []
	) {
		this.validators = Array.isArray(validators) ? validators : [validators];
	}

	getValue = (): R => this.value;

	validate = (): Either<FailedMessage, R> =>
		this.validators.reduce<Either<FailedMessage, R>>(
			(acc, validator) => acc.chain(validator),
			right(this.value)
		);

	setNewValue = (newValue: R): FormField<R> =>
		new FormField(newValue, this.validators);
}

type FormFieldValueType<F> = F extends FormField<infer R>
	? R
	: F extends FormFieldGroup<infer G>
	? G
	: never;

type Path<T, Depth extends number = 5> = [Depth] extends [0]
	? never
	: {
			[K in keyof T & string]: T[K] extends FormField<any>
				? K
				: T[K] extends FormFieldGroup<any>
				?
						| K
						| `${K}.${Path<
								T[K] extends FormFieldGroup<infer G>
									? G
									: never,
								Depth extends 1
									? 0
									: Depth extends number
									? 1
									: never
						  > &
								string}`
				: never;
	  }[keyof T & string];

type PathValue<T, P extends Path<T>> = P extends keyof T
	? T[P] extends FormField<infer R>
		? R
		: never
	: P extends `${infer K}.${infer Rest}`
	? K extends keyof T
		? T[K] extends FormFieldGroup<infer G>
			? PathValue<G, Rest & Path<G>>
			: never
		: never
	: never;

class FormFieldGroup<
	T extends Record<string, FormField<any> | FormFieldGroup<any>>
> {
	private groupValidators: ValueValidator<T>[];

	constructor(
		private fields: T,
		groupValidators: ValueValidator<T>[] | ValueValidator<T> = []
	) {
		this.groupValidators = Array.isArray(groupValidators)
			? groupValidators
			: [groupValidators];
	}

	getFields = (): T => this.fields;

	// Expose validators for internal access
	getGroupValidators = (): ValueValidator<T>[] => this.groupValidators;

	validateGroup = (): Either<FailedMessage, T> => {
		const fieldValidationResults = Object.values(this.fields).reduce<
			Either<FailedMessage, T>
		>(
			(acc, field) =>
				acc.chain(() =>
					field instanceof FormField
						? field.validate().map(() => this.fields)
						: field.validateGroup().map(() => this.fields)
				),
			right(this.fields)
		);
		const groupValidationResult = this.groupValidators.reduce<
			Either<FailedMessage, T>
		>(
			(acc, validator) => acc.chain(() => validator(this.fields)),
			right(this.fields)
		);
		return fieldValidationResults.chain(() => groupValidationResult);
	};

	setNewValue = <K extends keyof T>(
		fieldName: K,
		newValue: FormFieldValueType<T[K]>
	): FormFieldGroup<T> => {
		const currentField = this.fields[fieldName];

		let updatedField: T[K];

		if (currentField instanceof FormField) {
			updatedField = currentField.setNewValue(newValue) as T[K];
		} else if (currentField instanceof FormFieldGroup) {
			// This case needs more specific handling based on your requirements
			throw new Error(
				'Cannot directly set value on FormFieldGroup. Use setValueByPath instead.'
			);
		} else {
			throw new Error(`Unsupported field type for ${String(fieldName)}`);
		}

		return new FormFieldGroup(
			{
				...this.fields,
				[fieldName]: updatedField,
			},
			this.groupValidators
		);
	};
}

class Form<T extends Record<string, FormField<any> | FormFieldGroup<any>>> {
	private formValidators: ValueValidator<T>[];

	constructor(
		private fields: T,
		formValidators: ValueValidator<T>[] | ValueValidator<T> = []
	) {
		this.formValidators = Array.isArray(formValidators)
			? formValidators
			: [formValidators];
	}

	getForm = (): T => this.fields;

	validateForm = (): Either<FailedMessage, T> => {
		const fieldValidationResults = Object.values(this.fields).reduce<
			Either<FailedMessage, T>
		>(
			(acc, field) =>
				acc.chain(() =>
					field instanceof FormField
						? field.validate().map(() => this.fields)
						: field.validateGroup().map(() => this.fields)
				),
			right(this.fields)
		);
		const formValidationResult = this.formValidators.reduce<
			Either<FailedMessage, T>
		>(
			(acc, validator) => acc.chain(() => validator(this.fields)),
			right(this.fields)
		);
		return fieldValidationResults.chain(() => formValidationResult);
	};

	// Método simple para fields de primer nivel
	setFieldValue = <K extends keyof T>(
		fieldName: K,
		newValue: FormFieldValueType<T[K]>
	): Form<T> => {
		const currentField = this.fields[fieldName];

		let updatedField: T[K];

		if (currentField instanceof FormField) {
			updatedField = currentField.setNewValue(newValue) as T[K];
		} else if (currentField instanceof FormFieldGroup) {
			throw new Error(
				'Cannot directly set value on FormFieldGroup. Use setValueByPath instead.'
			);
		} else {
			throw new Error(`Unsupported field type for ${String(fieldName)}`);
		}

		return new Form(
			{
				...this.fields,
				[fieldName]: updatedField,
			},
			this.formValidators
		);
	};

	// Método avanzado usando paths para campos anidados

	setValueByPath = <P extends Path<T>>(
		path: P,
		newValue: PathValue<T, P>
	): Form<T> => {
		const pathArray = path.split('.');
		const updatedFields = this.updateNestedFieldTyped(
			this.fields,
			pathArray,
			newValue
		);
		return new Form(updatedFields, this.formValidators);
	};

	private updateNestedFieldTyped = <
		Obj extends Record<string, FormField<any> | FormFieldGroup<any>>
	>(
		obj: Obj,
		path: string[],
		newValue: any
	): Obj => {
		if (path.length === 0) {
			throw new Error('Invalid path: cannot replace entire object');
		}

		const [head, ...tail] = path;
		if (!(head in obj)) {
			throw new Error(`Invalid path: key '${head}' not found`);
		}

		const key = head as keyof Obj;
		const current = obj[key];

		if (current instanceof FormField) {
			if (tail.length === 0) {
				return {
					...obj,
					[key]: current.setNewValue(newValue),
				};
			}
			throw new Error(`Cannot traverse deeper into FormField at ${head}`);
		}

		if (current instanceof FormFieldGroup) {
			return {
				...obj,
				[key]: new FormFieldGroup(
					this.updateNestedFieldTyped(
						current.getFields(),
						tail,
						newValue
					),
					current.getGroupValidators()
				),
			};
		}

		throw new Error(`Unsupported field type at path: ${head}`);
	};

	getValueByPath = <P extends Path<T>>(path: P): PathValue<T, P> => {
		const pathArray = path.split('.');
		return this.getNestedValue(this.fields, pathArray);
	};

	private getNestedValue = (
		obj: Record<string, any>,
		path: string[]
	): any => {
		if (path.length === 0) return obj;

		const [head, ...tail] = path;
		const current = obj[head];

		if (current instanceof FormField) {
			if (tail.length === 0) {
				return current.getValue();
			}
			throw new Error(`Cannot traverse deeper into FormField at ${head}`);
		}

		if (current instanceof FormFieldGroup) {
			return this.getNestedValue(current.getFields(), tail);
		}

		return this.getNestedValue(current, tail);
	};
}

// Ejemplo de uso:
/*
const userForm = new Form({
	name: new FormField('John', []),
	address: new FormFieldGroup({
		street: new FormField('123 Main St', []),
		city: new FormField('New York', []),
		coordinates: new FormFieldGroup({
			lat: new FormField(40.7128, []),
			lng: new FormField(-74.0060, [])
		})
	})
});

// Actualizar campo simple
const updatedForm1 = userForm.setFieldValue('name', 'Jane');

// Actualizar campo anidado usando path
const updatedForm2 = userForm.setValueByPath('address.street', '456 Oak Ave');
const updatedForm3 = userForm.setValueByPath('address.coordinates.lat', 41.8781);

// Obtener valores
const name = userForm.getValueByPath('name'); // 'John'
const street = userForm.getValueByPath('address.street'); // '123 Main St'
const lat = userForm.getValueByPath('address.coordinates.lat'); // 40.7128
*/

export { Form, FormField, FormFieldGroup };
