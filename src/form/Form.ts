import { Either, right } from '@sweet-monads/either';

type FailedMessage = {
	message: string;
};

type ValueValidator<R> = (value: R) => Either<FailedMessage, R>;


type FormTree = Record<string, FormField<any> | FormFieldGroup<any>>;

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

type Path<T extends FormTree> = {
	[K in keyof T]: T[K] extends FormField<any>
		? `${K & string}`
		: T[K] extends FormFieldGroup<infer G>
		? `${K & string}.${Path<G>}`
		: never;
}[keyof T];

type PathValue<
	T extends FormTree,
	P extends string
> = P extends `${infer Head}.${infer Tail}`
	? Head extends keyof T
		? T[Head] extends FormFieldGroup<infer G>
			? PathValue<G, Tail>
			: never
		: never
	: P extends keyof T
	? T[P] extends FormField<infer V>
		? V
		: T[P] extends FormFieldGroup<infer G>
		? G
		: never
	: never;

abstract class FormBase<T extends FormTree> {
	protected constructor(protected fields: T) {}

	getValueByPath = <P extends Path<T>>(path: P): PathValue<T, P> => {
		const pathArray = path.split('.');
		return this.getNestedValue(this.fields, pathArray);
	};

	private getNestedValue = <Obj extends FormTree, R>(
		obj: Obj,
		path: string[]
	): R => {
		if (path.length === 0) throw new Error('Invalid path: empty path');

		const [head, ...tail] = path;
		if (!(head in obj))
			throw new Error(`Invalid path: key '${head}' not found`);

		const current = obj[head];

		if (current instanceof FormField) {
			if (tail.length === 0) return current.getValue();
			throw new Error(`Cannot traverse deeper into FormField at ${head}`);
		}

		if (current instanceof FormFieldGroup) {
			return this.getNestedValue(current.getFields(), tail);
		}

		return this.getNestedValue(current, tail);
	};

	setValueByPath = <P extends Path<T>>(
		path: P,
		newValue: PathValue<T, P>
	): this => {
		const pathArray = path.split('.');
		const updatedFields = this.updateNestedField(
			this.fields,
			pathArray,
			newValue
		);
		return this.createInstance(updatedFields);
	};

	 private updateNestedField = <Obj extends FormTree, P extends Path<Obj>>(
        obj: Obj,
        path: string[],
        newValue: PathValue<Obj, P>
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
                return { ...obj, [key]: current.setNewValue(newValue) };
            }
            throw new Error(`Cannot traverse deeper into FormField at ${head}`);
        }

        if (current instanceof FormFieldGroup) {
            return {
                ...obj,
                [key]: current.setValueByPath(tail.join('.') as any, newValue),
            };
        }

        throw new Error(`Unsupported field type at path: ${head}`);
    };

	protected abstract createInstance(fields: T): this;
}

class FormFieldGroup<T extends FormTree> extends FormBase<T> {
	private groupValidators: ValueValidator<T>[];

	constructor(
		fields: T,
		groupValidators: ValueValidator<T>[] | ValueValidator<T> = []
	) {
		super(fields);
		this.groupValidators = Array.isArray(groupValidators)
			? groupValidators
			: [groupValidators];
	}

	getFields = (): T => this.fields;

	validateGroup = (): Either<FailedMessage, T> => {
		const fieldValidations = Object.values(this.fields).reduce<
			Either<FailedMessage, T>
		>(
			(acc, field) =>
				acc.chain(() =>
					field instanceof FormField
						? field.validate().map(() => this.fields)
						: field instanceof FormFieldGroup
						? field.validateGroup().map(() => this.fields)
						: right(this.fields)
				),
			right(this.fields)
		);

		const groupValidations = this.groupValidators.reduce<
			Either<FailedMessage, T>
		>(
			(acc, validator) => acc.chain(() => validator(this.fields)),
			right(this.fields)
		);

		return fieldValidations.chain(() => groupValidations);
	};

	protected createInstance(fields: T): this {
		return new FormFieldGroup(fields, this.groupValidators) as this;
	}
}

class Form<T extends FormTree> extends FormBase<T> {
	private formValidators: ValueValidator<T>[];

	constructor(
		fields: T,
		formValidators: ValueValidator<T>[] | ValueValidator<T> = []
	) {
		super(fields);
		this.formValidators = Array.isArray(formValidators)
			? formValidators
			: [formValidators];
	}

	getForm = (): T => this.fields;

	validateForm = (): Either<FailedMessage, T> => {
		const fieldValidations = Object.values(this.fields).reduce<
			Either<FailedMessage, T>
		>(
			(acc, field) =>
				acc.chain(() =>
					field instanceof FormField
						? field.validate().map(() => this.fields)
						: field instanceof FormFieldGroup
						? field.validateGroup().map(() => this.fields)
						: right(this.fields)
				),
			right(this.fields)
		);

		const formValidations = this.formValidators.reduce<
			Either<FailedMessage, T>
		>(
			(acc, validator) => acc.chain(() => validator(this.fields)),
			right(this.fields)
		);

		return fieldValidations.chain(() => formValidations);
	};

	protected createInstance(fields: T): this {
		return new Form(fields, this.formValidators) as this;
	}
}

export { Form, FormField, FormFieldGroup };
